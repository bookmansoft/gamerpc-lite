const {extendObj, CommStatus, clone, ReturnCodeName, ReturnCode, CommMode} = require('./utils/util');
const Indicator = require('./utils/Indicator');

/**
 * RPC控件
 * @note
 *      1、根据创建参数，可分别支持WS、Socket、Http三种常用通讯模式，支持Notify、JSONP、Watching等报文通讯模式
 *      2、支持LBS重定向功能
 *      3、内部封装了一定的断言功能
 */
class Remote {
    constructor(options) {
        this.rpcMode = CommMode.post;
        this.loginMode = Indicator.inst();
        this.configOri = options;                   //读取并保存初始配置，不会修改
        this.config = clone(this.configOri);        //复制一份配置信息，有可能修改
        this.userInfo = {};

        //状态管理器
        this.status = Indicator.inst(options.status);
    }

    async onAuthCode(code) {
        return await this.setSign(code).login();
    }

    /**
     * 修改通讯模式
     * @param {*} $mode     通讯模式
     * @param {*} cb        建立连接时的回调
     */
    setmode($mode) {
        this.rpcMode = $mode;
        return this;
    }

    /**
     * 获取OpenId
     */
    async getOpenId() {
        //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
        let msg = await this.getRequest({
            port: this.configOri.webserver.authPort, 
            openkey: this.userInfo.openkey, 
        }, this.userInfo.domain);

        //客户端从模拟网关取得了签名集
        if(!msg) {
            return false;
        }

        this.userInfo.openid = msg.unionid;

        return true;
    }

    /**
     * 获取签名数据集
     */
    async getSign() {
        //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
        let msg = await this.getRequest({openid: this.userInfo.openid, addrType: this.userInfo.addrType, address: this.userInfo.address }, this.userInfo.domain);
        //客户端从模拟网关取得了签名集
        if(!msg) {
            return false;
        }

        this.userInfo.auth = msg;

        return true;
    }

    /**
     * 设置验证码
     * @param {*} code 
     */
    setSign(code) {
        if(!!this.userInfo) {
            if(this.loginMode.check(CommStatus.reqSign)) {
                this.status.set(CommStatus.signCode);
                this.userInfo.openkey = code;
            }
        }
        return this;
    }

    /**
     * 登录并获得令牌
     */
    async getToken() {
        if(!this.userInfo 
            || (this.loginMode.check(CommStatus.reqLb) && !this.status.check(CommStatus.lb)) 
            || (this.loginMode.check(CommStatus.reqSign) && !this.status.check(CommStatus.signCode)
            || this.status.check(CommStatus.logined))
        ) {
            //不满足登录的前置条件或已经登录
            return false;
        }

        //将签证发送到服务端进行验证
        let msg = await this.fetching({
            'func': '1000',
            "oemInfo": this.userInfo,
        });

        if(!!msg && msg.code == ReturnCode.Success && !!msg.data) {
            this.userInfo.openid = msg.data.openid;
            this.userInfo.id = msg.data.id;
            this.userInfo.token = msg.data.token;
            this.userInfo.name = msg.data.name;
            this.status.set(CommStatus.logined);

            return true;
        } 
        return false;
    }

    /**
     * 清空先前的缓存状态
     */
    clearCache() {
        if(this.userInfo) {
            this.userInfo.token = null; 
        }
    }

    /**
     * 执行负载均衡流程
     * @param {*} ui 
     */
    async setLB(force) {
        if(!this.userInfo) {
            //尚未设置有效的用户数据，无法执行
            return false;
        }

        if(!force && this.status.check(CommStatus.lb)) {
            //已经执行过LB操作，且非强制执行模式
            return true;
        }

        this.clearCache();
        this.status.init();

        let msg = await this.locate(this.configOri.webserver.host, this.configOri.webserver.port)
        .getRequest({"func": "config.getServerInfo", "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}});

        if(!!msg && msg.code == ReturnCode.Success) {
            this.status.set(CommStatus.lb);
            this.locate(msg.data.ip, msg.data.port);
            return true;
        }

        return false;
    }

    /**
     * 登录流程
     * @param {Object} options
     * @param {Boolean} options.force 强制登录
     */
    async login(options) {
        options = options || {};
        if(options.force) {
            this.clearCache();
            this.status.init();
        }

        if(options.domain) {
            switch(options.domain) {
                case 'authwx': {
                    this.setUserInfo({
                        domain: options.domain,     //认证模式
                        openkey: options.openkey,   //中间证书，经由Auth服务器转换成 openid 下发给客户端
                    }, CommStatus.reqLb | CommStatus.reqOpenId);

                    break;
                }
                case 'auth2step': {
                    this.setUserInfo({
                        domain: options.domain,     //验证模式
                        openid: options.openid,     //用户证书
                        addrType: options.addrType, //验证方式
                        address: options.address,   //验证地址
                    }, CommStatus.reqLb | CommStatus.reqSign);

                    break;
                }
                default: {
                    throw(new Error('Unknown domain name'));
                }
            }
        }

        if(this.status.check(CommStatus.logined)) {
            return false;
        }

        if(!this.userInfo) {
            return false;
        }

        //检测执行微信所需要的KeyId转换
        if(this.loginMode.check(CommStatus.reqOpenId)) {
            if(!this.status.check(CommStatus.OpenId)) {
                if(!(await this.getOpenId())) {
                    throw(new Error('keyId error'));
                } else {
                    this.status.set(CommStatus.OpenId);
                }
            }
        }

        //检测执行负载均衡
        if(this.loginMode.check(CommStatus.reqLb)) {
            if(!this.status.check(CommStatus.lb)) {
                //如果需要负载均衡且尚未执行，执行如下语句
                if(!(await this.setLB())) {
                    //如果负载均衡失败，抛出异常，外围程序负责重新调用
                    throw(new Error('lb error'));
                } else {
                    this.status.set(CommStatus.lb);
                }
            }
        }

        //检测执行两阶段验证
        //两阶段验证模式(例如浏览器直接登录)：执行此操作，访问控制器方法 domain.auth 获取签名对象，并赋值到 userInfo.auth 字段，服务端同时会将关联验证码通过邮件或短信下发
        //第三方授权登录模式(例如微信或QQ登录)：跳过此步
        if(this.loginMode.check(CommStatus.reqSign)) {
            if(!this.status.check(CommStatus.sign)) {
                //如果需要两阶段验证且尚未执行，执行如下语句
                if(!(await this.getSign())) {
                    //如果负载均衡失败，抛出异常，外围程序负责重新调用
                    throw(new Error('get sign error'));
                } else {
                    this.status.set(CommStatus.sign);
                    return true;
                }
            } else {
                return await this.getToken();
            }
        } else {
            return await this.getToken();
        }
    }

    /**
     * 设置用户信息
     * 1. 支持局部设定模式
     * 2. 每次设置，状态类缓存会被清除，通讯状态被复原
     * @param {Object} ui {openid}
     * @param {Number} st 登录流程描述符
     */
    setUserInfo(ui, st) {
        this.userInfo = this.userInfo || {};

        this.clearCache();

        //设置登录模式
        if(!!st) {
            this.loginMode.init(st);
        }

        //合并对象数据
        extendObj(this.userInfo, ui);

        return this;
    }

    /**
     * 获取新的远程对象
      * @returns {Remote}
     */
    get new(){
        return new Remote(this.configOri).setmode(this.rpcMode);
    }

    /**
     * 为了提供node下的兼容性而添加的属性设定函数
     * @param {*} fn 
     */
    setFetch(fn) {
        this.fetch = fn;
        return this;
    }

    /**
     * 向服务端提交请求,默认JSONP模式
     * @param params        命令参数，JSON对象
     *      .command    命令名称，格式: obj.func, 可以缩写为 func，此时obj为默认值'index'，例如 index.setNewbie 等价于 setNewbie
     *      .url        附加url地址
     * @param callback      回调函数
     * @returns {*}
     */
    async fetching(params) {
        this.parseParams(params);

        if(this.loginMode.check(CommStatus.reqLb) && !this.status.check(CommStatus.lb)) {
            await this.setLB();
        }

        switch(this.rpcMode) {
            case CommMode.get:
                return this.getRequest(params);

            case CommMode.post:
                return this.postRequest(params);
        }

        return Promise.reject();
    }

    /**
     * 设定远程服务器地址
     * @param ip
     * @param port
     * @returns {Remote}
     */
    locate(ip, port){
        this.config.webserver.host = ip;
        this.config.webserver.port = port;

        return this;
    }

    /**
     * 彻底清除连接器历史数据，包括通讯状态、运行数据缓存、注册事件句柄，只保留最原始的配置信息
     */
    init() {
        this.config = clone(this.configOri);        //复制一份配置信息，有可能修改
        this.userInfo = {};
        this.status.init();
        this.loginMode.init();
        
        return this;
    }

    /**
     * 参数调整
     * @param params
     */
    parseParams(params) {
        params.func = !!params.func ? params.func : 'index.login';
        //填充自动登录参数
        let arr = params.func.split('.');
        if(arr.length > 1){
            params.control = arr[0];
            params.func = arr[1];
        }
        else{
            params.func = arr[0];
        }

        params.oemInfo = this.userInfo || {};
    }

    /**
     * 以 GET 方式访问远程API
     * @param {*} url       远程地址
     */
    async get(url) {
        const newOptions = { json: true };
        
        newOptions.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
        };

        if(this.fetch) {
            let ret = await this.fetch(url, newOptions);
            return await ret.json();
        }
        else {
            let ret = await fetch(url, newOptions);
            return await ret.json();
        }
    }

    /**
     * 以 POST 方式访问远程API
     * @param {*} url       远程地址
     * @param {*} options   body
     */
    async post(url, options) {
        const newOptions = { json: true, method: 'POST', body: JSON.stringify(options) };
        
        newOptions.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
        };

        try {
            if(this.fetch) {
                let ret = await this.fetch(url, newOptions);
                return await ret.json();
            }
            else {
                let ret = await fetch(url, newOptions);
                return await ret.json();
            }
        }
        catch(e) {
            console.error(e);
        }
    }
  
    /**
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     */
    async getRequest(params, authControl) {
        this.parseParams(params);

        let port = !!params.port ? params.port : this.config.webserver.port;
        let url = !!authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${port}/${authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${port}/index.html`;
        url += "?" + Object.keys(params).reduce((ret, next)=>{
                if(ret != '') { 
                    ret += '&';
                }
                //增加了字段编译，避免特殊字符如汉字对URL拼接造成干扰
                return ret + next + "=" + ((typeof params[next]) == "object" ? encodeURIComponent(JSON.stringify(params[next])) : encodeURIComponent(params[next]));
            }, '');

        return this.get(url);
    }

    /**
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     */
    async postRequest(params, authControl) {
        this.parseParams(params);

        let port = !!params.port ? params.port : this.config.webserver.port;
        let url = !!authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${port}/${authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${port}/index.html`;

        return this.post(url, params);
    }
}

module.exports = Remote;
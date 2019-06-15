/*!
 * util.js - utils for gamegold
 * Copyright (c) 2018-2020, Bookman Software (MIT License).
 */

'use strict';

/**
 * @exports utils/util
 */

const util = exports;

/**
 * Get current time in unix time (seconds).
 * @returns {Number}
 */

util.now = function now() {
  return Math.floor(util.ms() / 1000);
};

/**
 * Get current time in unix time (milliseconds).
 * @returns {Number}
 */

util.ms = function ms() {
  return Date.now();
};

/**
 * Create a Date ISO string from time in unix time (seconds).
 * @param {Number?} time - Seconds in unix time.
 * @returns {String}
 */

util.date = function date(time) {
  if (time == null)
    time = util.now();

  return new Date(time * 1000).toISOString().slice(0, -5) + 'Z';
};

/**
 * Get unix seconds from a Date string.
 * @param {String?} date - Date ISO String.
 * @returns {Number}
 */

util.time = function time(date) {
  if (date == null)
    return util.now();

  return new Date(date) / 1000 | 0;
};

/**
 * Get random range.
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */

util.random = function random(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * 客户端请求返回值，统一定义所有的错误码，每100个为一个大类
 */
const ReturnCode = {
    Success: 0,           //操作成功
};

/**
 * 通讯连接状态
 */
const CommStatus = {
  lb:         1,      //已经执行了LB重定位
  sign:       2,      //已经获得签名数据集
  signCode:   4,      //已经获得验证码
  OpenId:     8,      //已经成功获得 OpenId
  logined:    16,      //已经成功登录
  reqSign:    1024,   //需要获取两阶段认证的签名数据
  reqLb:      2048,   //需要执行负载均衡
  reqOpenId:  4096,   //需要执行从OPENKEY到OPENID的转换操作
}

const ReturnCodeName = {
	0: '操作成功',
}

const CommMode = {
    ws: "webSocket",    //Web Socket
    get: "get",         //HTTP GET
    post: "post",       //HTTP POST
}

/**
 * 扩展对象，用于多个对象之间的属性注入
 * @note 对属性(get set)复制不会成功
 * @returns {*|{}}
 */
function extendObj(){
    /*
 　　*target被扩展的对象
　 　*length参数的数量
　　 *deep是否深度操作
　　*/
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // target为第一个参数，如果第一个参数是Boolean类型的值，则把target赋值给deep
    // deep表示是否进行深层面的复制，当为true时，进行深度复制，否则只进行第一层扩展
    // 然后把第二个参数赋值给target
    if ( typeof target === "boolean" ) {
        deep = target;
        target = arguments[1] || {};

        // 将i赋值为2，跳过前两个参数
        i = 2;
    }

    // target既不是对象也不是函数则把target设置为空对象。
    if ( typeof target !== "object" && !(target.constructor == Function) ) {
        target = {};
    }

    // 如果只有一个参数，则把jQuery对象赋值给target，即扩展到jQuery对象上
    if ( length === i ) {
        target = this;

        // i减1，指向被扩展对象
        --i;
    }

    // 开始遍历需要被扩展到target上的参数
    for ( ; i < length; i++ ) {
        // 处理第i个被扩展的对象，即除去deep和target之外的对象
        if ( (options = arguments[ i ]) != null ) {
            // 遍历第i个对象的所有可遍历的属性
            for ( name in options ) {
                // 根据被扩展对象的键获得目标对象相应值，并赋值给src
                src = target[ name ];
                // 得到被扩展对象的值
                copy = options[ name ];

                if ( src === copy ) {
                    continue;
                }

                // 当用户想要深度操作时，递归合并
                // copy是纯对象或者是数组
                if ( deep && copy && ( (copy.constructor == Object) || (copyIsArray = (copy.constructor == Array)) ) ) {
                    // 如果是数组
                    if ( copyIsArray ) {
                        // 将copyIsArray重新设置为false，为下次遍历做准备。
                        copyIsArray = false;
                        // 判断被扩展的对象中src是不是数组
                        clone = src && (src.constructor == Array) ? src : [];
                    } else {
                        // 判断被扩展的对象中src是不是纯对象
                        clone = src && (src.constructor == Object) ? src : {};
                    }

                    // 递归调用extend方法，继续进行深度遍历
                    target[ name ] = extendObj( deep, clone, copy );
                } else if ( copy !== undefined ) {// 如果不需要深度复制，则直接copy（第i个被扩展对象中被遍历的那个键的值）
                    target[ name ] = copy;
                }
            }
        }
    }

    // 原对象被改变，因此如果不想改变原对象，target可传入{}
    return target;
};

/**
 * 复制一个对象
 * @param obj
 * @returns {*}
 */
function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    if (obj instanceof Date) {// Handle Date
        let copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }
    else if (obj instanceof Array) {// Handle Array
        let copy = [];
        for (let i = 0, len = obj.length; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }
    else if (obj instanceof Object) {// Handle Object
        let copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

util.ReturnCode = ReturnCode;
util.ReturnCodeName = ReturnCodeName;
util.CommMode = CommMode;
util.extendObj = extendObj;
util.clone = clone;
util.CommStatus = CommStatus;

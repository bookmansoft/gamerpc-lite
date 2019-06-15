/**
 * 为数组添加方法：取随机对象
 */
Array.prototype.randObj = function() {
    if(this.length == 0){
        return null;
    }
    else if(this.length == 1){
        return this[0];
    }
    else{
        return this[(Math.random()*this.length)|0];
    }
}

const {CommStatus, ReturnCode, CommMode, stringify} = require('./utils/util');

const toolkit = exports;

//游戏云连接器
toolkit.gameconn = require('./gameConn');

//实用函数列表
toolkit.stringify = stringify;
toolkit.CommMode = CommMode;
toolkit.CommStatus = CommStatus;
toolkit.ReturnCode = ReturnCode;

toolkit.gameconn.prototype.stringify = stringify;
toolkit.gameconn.prototype.CommMode = CommMode;
toolkit.gameconn.prototype.CommStatus = CommStatus;
toolkit.gameconn.prototype.ReturnCode = ReturnCode;

global.toolkit = toolkit;

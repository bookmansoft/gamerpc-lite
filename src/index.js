const {CommStatus, ReturnCode, CommMode} = require('./utils/util');

const toolkit = exports;

//游戏云连接器
toolkit.gameconn = require('./gameConn');

//实用函数列表
toolkit.CommMode = CommMode;
toolkit.CommStatus = CommStatus;
toolkit.ReturnCode = ReturnCode;

toolkit.gameconn.prototype.CommMode = CommMode;
toolkit.gameconn.prototype.CommStatus = CommStatus;
toolkit.gameconn.prototype.ReturnCode = ReturnCode;

global.toolkit = toolkit;

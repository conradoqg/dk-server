const logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);
require('../lib/util/consoleWrapper.js')('dk-server', logLevel);
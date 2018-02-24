const HTTPServer = require('./httpServer');
const Docker = require('./docker');
const Auth = require('./auth');
const StackTemplate = require('./template/stackTemplate');
const DB = require('./db');
const package = require('../package.json');

module.exports = function dkServer(host, port, logLevel) {
    host = process.env.HOST || host || 'localhost';
    port = process.env.PORT || process.env.HTTP_PORT || port || 80;
    logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);

    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    console.info(`
 ____________      ______  ______ 
/dddddddddddd\\_   |kkkkkk|/kkkkk/
\\dddddddddddddd\\_ |kkkkk//kkkkk/
 \\ddddddddddddddd\\|kkkk|/kkkkk/
 \\dddddd__dddddddd\\kkkk kkkkk/
  \\ddddd\\ \\ddddddddd\\kkkkkkk/
  \\dddddd\\  \\dddddddd\\kkkkk/   
   \\ddddd|   |dddddddd\\kkkk\\ 
   \\dddddd\\  /dddddddd|kkkkk\\  
    \\ddddd|_/ddddddddd|kkkkkk\\
    \\ddddddddddddddddd|k|\\kkkk\\
     \\ddddddddddddddd/kk||kkkkk\\
     \\dddddddddddddd/kkk| \\kkkkk\\
      \\dddddddddddd/kkkkk\\ \\kkkkk\\
       |ddddddddddd/|kkkkk|  \\kkkkk\\ Server 

Version: ${package.version} 
Mode: ${process.env.NODE_ENV}    
       -----------  -----    ------`);

    require('./util/consoleWrapper.js')('dk-server', logLevel);

    (async () => {
        try {
            const dbService = new DB();
            const config = dbService.config.getConfig();
            const dockerService = new Docker(config.maxStacksPerUser, config.serviceType);
            await dockerService.connect();
            const authService = new Auth(dbService.users);
            const stackTemplateService = new StackTemplate(dbService.stackTemplates);
            const server = new HTTPServer(dockerService, authService, stackTemplateService);
            server.listen(host, port);
        } catch (ex) {
            console.error(ex);
        }
    })();
};
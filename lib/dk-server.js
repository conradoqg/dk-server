const HTTPServer = require('./httpServer');
const Docker = require('./docker');
const Auth = require('./auth');
const StackTemplate = require('./template/stackTemplate');
const DB = require('./db');

module.exports = function dkServer(host, port, logLevel) {
    host = process.env.HOST || host || 'localhost';
    port = process.env.PORT || process.env.HTTP_PORT || port || 80;
    logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);

    require('./util/consoleWrapper.js')('dk-server', logLevel);

    const dockerService = new Docker();
    const dbService = new DB();
    const authService = new Auth(dbService);    
    const stackTemplateService = new StackTemplate(dbService);
    const server = new HTTPServer(dockerService, authService, stackTemplateService);
    server.listen(host, port);
};
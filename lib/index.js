const HTTPServer = require('./httpServer');
const Docker = require('./docker');
const Auth = require('./auth');
const StackTemplate = require('./template/stackTemplate');
const DB = require('./db');

const dockerService = new Docker();
const dbService = new DB();
const authService = new Auth(dbService);
const stackTemplateService = new StackTemplate(dbService);
const server = new HTTPServer(dockerService, authService, stackTemplateService);
server.listen('localhost', '80');
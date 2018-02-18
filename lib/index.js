const HTTPServer = require('./httpServer');
const Docker = require('./docker');
const Auth = require('./auth');
const DB = require('./db');

const dockerService = new Docker();
const dbService = new DB();
const authService = new Auth(dbService);
const server = new HTTPServer(dockerService, authService, dbService);
server.listen('localhost', '80');
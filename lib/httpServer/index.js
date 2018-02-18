const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const asyncHandler = require('express-async-handler');
const swaggerDocument = require('./swagger.json');
const HTTPError = require('./httpError');
const AuthException = require('../auth/authException');
const projection = require('./projection');

class HTTPServer {
    constructor(dockerService, authService) {
        this.app = express();
        this.app.use(bodyParser.json());
        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

        this.app.get('/ping', (req, res) => {
            res.status(200).json('pong');
        });

        this.app.get('/healthcheck', asyncHandler(async (req, res) => {

            const isDockerThere = await dockerService.ping();

            res.status(200).json(projection.healthcheckResult(isDockerThere));
        }));

        this.app.get('/stacks', [authService.middleware, asyncHandler(async (req, res) => {
            const stacks = await dockerService.getStacks(req.user);

            res.status(200).json(projection.stacks(stacks));
        })]);

        this.app.post('/stacks', [authService.middleware, asyncHandler(async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const composeTemplateName = req.body.composeTemplateName;
            const stackName = req.body.stackName;

            const fs = require('fs');
            const util = require('util');
            const path = require('path');
            const readdir = util.promisify(fs.readdir);
            const TEMPLATESPATH = path.join(__dirname, '../../stackTemplates/');
            const templateList = await readdir(TEMPLATESPATH);

            const templateFound = templateList.find(template => template == composeTemplateName + '.yml');

            if (templateFound) {
                const creationResult = await dockerService.createStack(req.user, path.join(TEMPLATESPATH, templateFound), stackName);

                if (creationResult)
                    res.status(200).json(projection.stackCreationResult(creationResult));
                else
                    throw new HTTPError(400, `Max instances for user '${req.user.email}' reached`);
            } else {
                throw new HTTPError(400, `Template '${composeTemplateName}' not found`);
            }
        })]);

        this.app.get('/stacks/:stackName', [authService.middleware, asyncHandler(async (req, res) => {
            const stackName = req.params.stackName;

            if (stackName == null) throw new HTTPError(400, 'The stackName parameter must be a string');

            const stack = await dockerService.getStackByName(req.user, stackName);

            if (stack)
                res.status(200).json(projection.stack(stack));
            else
                throw new HTTPError(404, `Stack '${stackName}' not found for user '${req.user.email}'.`);
        })]);

        this.app.delete('/stacks/:stackName', [authService.middleware, asyncHandler(async (req, res) => {
            const stackName = req.params.stackName;

            if (stackName == null) throw new HTTPError(400, 'The stackName parameter must be a string');

            const wasDeleted = await dockerService.removeStackByName(req.user, stackName);

            if (wasDeleted)
                res.status(200).json(projection.stackDeletionResult(wasDeleted));
            else
                throw new HTTPError(404, `Stack '${stackName}' not found for user '${req.user.email}'.`);
        })]);

        this.app.post('/token', asyncHandler(async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const email = req.body.email;
            const password = req.body.password;

            if (email == null || password == null) throw new HTTPError(401, 'Invalid email and/or password.');

            const token = await authService.createToken(email, password);

            res.status(200).json(projection.tokenResult(token));
        }));

        this.app.post('/users', asyncHandler(async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const email = req.body.email;
            const password = req.body.password;

            if (email == null || password == null) throw new HTTPError(401, 'Invalid email and/or password.');

            try {
                const userCreated = await authService.createUser(email, password);

                res.status(200).json(projection.userCreationResult(userCreated));
            } catch (ex) {
                if (ex instanceof AuthException) throw new HTTPError(400, `Invalid password: ${ex.message}`, null, ex);
                else throw ex;
            }
        }));

        this.app.use(function (err, req, res, next) {  // eslint-disable-line no-unused-vars            
            if (!(err instanceof HTTPError))
                err = new HTTPError(500, null, null, err);

            res.status(err.status);

            if (process.env.ENV == 'development') res.json(err);
            else res.json({ status: err.status, message: err.message });
        });
    }

    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                resolve(this);
            });
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                console.info('Closing http');
                resolve(this);
            });
        });
    }
}

module.exports = HTTPServer;

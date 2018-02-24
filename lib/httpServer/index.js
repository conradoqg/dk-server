const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const RateLimit = require('express-rate-limit');
const yaml = require('js-yaml');
const HTTPError = require('./httpError');
const AuthenticationError = require('../auth/authenticationError');
const AuthorizationError = require('../auth/authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const projection = require('./projection');

const swaggerDocument = yaml.safeLoad(require('fs-extra').readFileSync(require('path').join(__dirname, './swagger.yml')));

const apiLimiter = new RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    delayMs: 0 // disable delaying - full speed until the max limit is reached
});

let createUserLimiter = null;

if (process.env.NODE_ENV == 'development')
    createUserLimiter = (req, res, next) => next();
else
    createUserLimiter = new RateLimit({
        windowMs: 24 * 60 * 60 * 1000, // 1 day window
        delayAfter: 1, // begin slowing down responses after the first request
        delayMs: 3 * 1000, // slow down subsequent responses by 3 seconds per request
        max: 2, // start blocking after 2 requests
        message: 'Too many accounts created from this IP, please try again after a day'
    });

class HTTPServer {
    constructor(dockerService, authService, stackTemplateService) {
        this.dockerService = dockerService;
        this.authService = authService;
        this.stackTemplateService = stackTemplateService;

        this.app = express();

        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'views'));

        this.app.enable('trust proxy');

        this.app.use(compression());
        this.app.use(helmet());
        this.app.use(bodyParser.json());

        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

        if (process.env.NODE_ENV != 'development')
            this.app.use(apiLimiter);

        this.app.get('/ping', (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');
            res.status(200).json('pong');
        });

        this.app.get('/healthcheck', async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const isDockerThere = await dockerService.ping();

            res.status(200).json(projection.healthcheckResult(isDockerThere));
        });

        this.app.get('/stacks', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stacks = await dockerService.getStacks(req.user);

            res.status(200).json(projection.stacks(stacks));
        });

        this.app.post('/stacks', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplateName = req.body.stackTemplateName;
            const stackTemplateData = req.body.stackTempalteData;
            let stackName = req.body.stackName;

            if (stackTemplateName == null && stackTemplateData == null) throw new HTTPError(400, 'The stackTemplateName or stackTemplateData parameter must be a string');

            try {
                if (stackTemplateName != null) {
                    const stackTemplatePathFound = await stackTemplateService.getStackTemplatePathByName(req.user, stackTemplateName);

                    if (!stackTemplatePathFound) throw new InvalidOperationError(`Stack template '${stackTemplateName}' not found`);

                    stackName = await dockerService.createStackByTemplatePath(req.user, stackTemplatePathFound, stackName);
                } else {
                    stackName = await dockerService.createStackByTemplateData(req.user, stackTemplateData, stackName);
                }

                res.status(200).json(projection.stackCreationResult(stackName));
            } catch (ex) {
                if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.get('/stacks/:stackName', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackName = req.params.stackName;

            if (stackName == null) throw new HTTPError(400, 'The stackName parameter must be a string');

            const stack = await dockerService.getStackByName(req.user, stackName);

            if (!stack) throw new HTTPError(404, `Stack '${stackName}' not found for user '${req.user.name}'`);

            res.status(200).json(projection.stack(stack));
        });

        this.app.delete('/stacks/:stackName', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackName = req.params.stackName;

            if (stackName == null) throw new HTTPError(400, 'The stackName parameter must be a string');

            const stackDeleted = await dockerService.removeStackByName(req.user, stackName);

            if (!stackDeleted) throw new HTTPError(404, `Stack '${stackName}' not found for user '${req.user.name}'.`);

            res.status(200).json(projection.stackDeletionResult(stackDeleted));
        });

        this.app.get('/templates/stacks', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplatesFound = await stackTemplateService.getStackTemplates();

            res.status(200).json(stackTemplatesFound);
        });

        this.app.post('/templates/stacks', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplateName = req.body.stackTemplateName;
            const stackTemplateData = req.body.stackTemplateData;
            try {                
                const stackTemplateCreated = await stackTemplateService.createStackTemplate(req.user, stackTemplateName, stackTemplateData);

                res.status(200).json(stackTemplateCreated);
            } catch (ex) {
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.put('/templates/stacks', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplateName = req.body.stackTemplateName;
            const stackTemplateData = req.body.stackTemplateData;

            try {
                const stackTemplateUpdated = await stackTemplateService.updateStackTemplate(req.user, stackTemplateName, stackTemplateData);

                res.status(200).json(stackTemplateUpdated);
            } catch (ex) {
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.get('/templates/stacks/:stackTemplateName', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplateName = req.params.stackTemplateName;

            if (stackTemplateName == null) throw new HTTPError(400, 'The stackTemplateName parameter must be a string');

            const stackTemplate = await stackTemplateService.getStackTemplateByName(req.user, stackTemplateName);

            if (stackTemplate == null) throw new HTTPError(404, `Stack template '${stackTemplateName}' not found`);

            res.status(200).json(stackTemplate);
        });

        this.app.delete('/templates/stacks/:stackTemplateName', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const stackTemplateName = req.params.stackTemplateName;

            if (stackTemplateName == null) throw new HTTPError(400, 'The stackTemplateName parameter must be a string');

            try {
                const stackTemplateDeleted = await stackTemplateService.deleteStackTemplate(req.user, stackTemplateName);

                if (!stackTemplateDeleted) throw new HTTPError(404, `Stack template '${stackTemplateName}' not found`);

                res.status(200).json(stackTemplateDeleted);
            } catch (ex) {
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.get('/users', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            try {
                const users = await authService.getUsers(req.user);

                res.status(200).json(users.map(projection.user));
            } catch (ex) {
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.post('/users', createUserLimiter, authService.createMiddleware(false), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const name = req.body.name;
            const password = req.body.password;
            const type = req.body.type;

            if (name == null || password == null) throw new HTTPError(400, 'The parameter name and/or password must be a string');

            try {
                const userCreated = await authService.createUser(req.user, name, password, type);

                res.status(200).json(projection.user(userCreated));
            } catch (ex) {
                if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.put('/users', authService.createMiddleware(), async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            const name = req.body.name;
            const password = req.body.password;
            const type = req.body.type;

            if (name == null) throw new HTTPError(400, 'The parameter name must be a string');

            try {
                const userUpdated = await authService.updateUser(req.user, name, password, type);

                res.status(200).json(projection.user(userUpdated));
            } catch (ex) {
                if (ex instanceof InvalidOperationError) throw new HTTPError(400, ex.message, null, ex);
                if (ex instanceof AuthorizationError) throw new HTTPError(403, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.post('/token', async (req, res) => {
            if (req.headers['accept'] && !req.headers['accept'].includes('application/json')) throw new HTTPError(400, 'Accept content not supported');

            try {
                const name = req.body.name;
                const password = req.body.password;

                if (name == null || password == null) throw new HTTPError(400, 'The parameter name and/or password must be a string');

                const token = await authService.createToken(name, password);

                res.status(200).json(projection.tokenResult(token));
            } catch (ex) {
                if (ex instanceof AuthenticationError) throw new HTTPError(401, ex.message, null, ex);
                else throw ex;
            }
        });

        this.app.use(function (err, req, res, next) {  // eslint-disable-line no-unused-vars            
            if (!(err instanceof HTTPError))
                err = new HTTPError(500, null, null, err);

            res.status(err.status);
            console.error(JSON.stringify(err));

            if (process.env.NODE_ENV == 'development') res.json(err);
            else res.json({ status: err.status, message: err.message });
        });
    }

    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                this.authService.isUsersEmpty()
                    .then((isEmpty) => {
                        if (isEmpty) return this.authService.getFirstTimeToken();
                    })
                    .then((token) => {
                        if (token) console.info(`Initial token to create new users (expires in 5 hours): ${token}`);
                    });
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

require('mocha-steps');
require('chai').should();
const supertest = require('supertest');
const Chance = require('chance');
const HTTPServer = require('../../lib/httpServer');
const Docker = require('../../lib/docker');
const DB = require('../../lib/db');
const Auth = require('../../lib/auth');

const chance = new Chance();

const timeout = ms => new Promise(res => setTimeout(res, ms));

describe('HTTPServer', async () => {
    const context = {};

    before(async () => {
        const dockerService = new Docker();
        const dbService = new DB();
        const authService = new Auth(dbService);
        const server = new HTTPServer(dockerService, authService, dbService);
        context.server1 = server;
        context.userUser = {
            email: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string()
        };
        return await server.listen('localhost', '80');
    });

    it('should ping', async () => {
        return await supertest(context.server1.app)
            .get('/ping')
            .expect(200);
    });

    it('should be healthy', async () => {
        return await supertest(context.server1.app)
            .get('/healthcheck')
            .expect(200, {
                healthy: true
            });
    });

    it('should reject invalid creation of username and password', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .expect(401);
    });

    step('create a user', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userUser)
            .expect(200);
    });

    step('get token', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .send(context.userUser)
            .expect(200);
        context.tokenUser = tokenResponse.body.token;
    });

    step('get stacks of an user', async () => {
        const stacksResult = await supertest(context.server1.app)
            .get('/stacks')
            .set({ Authorization: context.tokenUser })
            .expect(200);
        stacksResult.body.should.be.an('array').that.is.empty;
    });

    step('create a stack for an user', async (done) => {
        try {
            const stackCreationResult = await supertest(context.server1.app)
                .post('/stacks')
                .set({ Authorization: context.tokenUser })
                .send({ composeTemplateName: 'docker-stack-sample1' })
                .expect(200);
            stackCreationResult.should.not.be.empty;
            stackCreationResult.body.should.not.be.empty;
            stackCreationResult.body.should.have.property('stackName');
            context.stack1 = stackCreationResult.body.stackName;
            await timeout(5000);
            done();
        } catch (ex) {
            done(ex);
        }
    }).timeout(15000);

    step('get the created stack of an user', async () => {
        const stackResult = await supertest(context.server1.app)
            .get(`/stacks/${context.stack1}`)
            .set({ Authorization: context.tokenUser })
            .expect(200);
        stackResult.body.should.not.be.empty;
    });

    step('delete the created stack of an user', async () => {
        const stackResult = await supertest(context.server1.app)
            .delete(`/stacks/${context.stack1}`)
            .set({ Authorization: context.tokenUser })
            .expect(200);
        stackResult.body.should.not.be.empty;
    });

    after(async () => {
        return await context.server1.stop();
    });
});
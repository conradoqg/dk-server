//require('../index');
require('mocha-steps');
require('chai').should();
const supertest = require('supertest');
const Chance = require('chance');
const HTTPServer = require('../../lib/httpServer');
const StackTemplate = require('../../lib/template/stackTemplate');
const Docker = require('../../lib/docker');
const DB = require('../../lib/db');
const Auth = require('../../lib/auth');
const Config = require('../../lib/config');
const Metric = require('../../lib/metric');

const chance = new Chance();
const timeout = ms => new Promise(res => setTimeout(res, ms));

describe('HTTPServer', async () => {
    const context = {};

    before(async () => {
        const dbService = new DB();
        const dockerService = new Docker(2, 'db_stack');
        await dockerService.connect();
        const authService = new Auth(dbService.users);
        const stackTemplateService = new StackTemplate(dbService.stackTemplates);
        const configService = new Config(dbService.config);
        const metricService = new Metric();
        const server = new HTTPServer(dockerService, authService, stackTemplateService, configService, metricService);

        context.server1 = server;
        context.dbService = dbService;
        context.initialToken = await authService.getFirstTimeToken();
        context.userInvalid = {
            name: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string({ length: 5 })
        };
        context.userUser1 = {
            name: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string({ length: 6 })
        };
        context.userUser2 = {
            name: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string({ length: 6 })
        };
        context.userUser3 = {
            name: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string({ length: 6 })
        };
        context.userAdmin1 = {
            name: chance.email({ domain: 'totvs.com.br' }),
            password: chance.string({ length: 6 }),
            type: 'admin'
        };
        context.sampleStackTemplate =
            `version: '3'

services:
    main:
        image: vfarcic/go-demo\${TAG}
        environment:
        - DB=db
        networks:
        - default
        ports:
            - :8080
        deploy:
            replicas: 3
            update_config:
                parallelism: 1
                delay: 10s
        labels:
            - com.df.notify=true
            - com.df.distribute=true
            - com.df.servicePath=/demo
            - com.df.port=8080
    db:
        image: mongo
        networks:
        - default

networks:
    default:
        external: false`;
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
            .expect(400);
    });

    step('create user 1', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userUser1)
            .expect(200);
    });

    step('create user 2', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userUser2)
            .expect(200);
    });

    step('create user 3', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userUser3)
            .expect(200);
    });

    step('create user admin 1', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userAdmin1)
            .expect(200);
    });

    step('create invalid user', async () => {
        return await supertest(context.server1.app)
            .post('/users')
            .send(context.userInvalid)
            .expect(400);
    });

    step('get token for user 1', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .send(context.userUser1)
            .expect(200);
        context.tokenUserUser1 = tokenResponse.body.token;
    });

    step('get token for an invaid user', async () => {
        await supertest(context.server1.app)
            .post('/token')
            .send({ name: 'none', password: 'none' })
            .expect(401);
    });

    step('get token for user 2', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .send(context.userUser2)
            .expect(200);
        context.tokenUserUser2 = tokenResponse.body.token;
    });

    step('get token for user 3', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .send(context.userUser3)
            .expect(200);
        context.tokenUserUser3 = tokenResponse.body.token;
    });

    step('change user 3 password', async () => {
        const newPassword = chance.string({ length: 6 });
        await supertest(context.server1.app)
            .put('/users')
            .set({ Authorization: context.tokenUserUser3 })
            .send({
                name: context.userUser3.name,
                password: newPassword
            })
            .expect(200);

        context.userUser3.password = newPassword;
    });

    step('get token for user 3 with the new password', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .send(context.userUser3)
            .expect(200);
        context.tokenUserUser3 = tokenResponse.body.token;
    });

    step('get token for user admin 1', async () => {
        const tokenResponse = await supertest(context.server1.app)
            .post('/token')
            .set({ Authorization: context.initialToken })
            .send(context.userAdmin1)
            .expect(200);
        context.tokenUserAdmin1 = tokenResponse.body.token;
    });

    step('change user 3 type to admin using admin user', async () => {
        await supertest(context.server1.app)
            .put('/users/')
            .set({ Authorization: context.tokenUserAdmin1 })
            .send({
                name: context.userUser3.name,
                type: 'admin'
            })
            .expect(200);
    });

    step('get all users using admin', async () => {
        const users = await supertest(context.server1.app)
            .get('/users')
            .set({ Authorization: context.tokenUserAdmin1 })
            .expect(200);
        users.body.should.be.an('array');
    });

    step('get stacks of user 1', async () => {
        const stacksResult = await supertest(context.server1.app)
            .get('/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .expect(200);
        stacksResult.body.should.be.an('array').that.is.empty;
    });

    step('create stack template using an admin', async () => {
        const stackTemplates = await supertest(context.server1.app)
            .post('/templates/stacks')
            .set({ Authorization: context.tokenUserAdmin1 })
            .send({ stackTemplateName: 'docker-stack-sample1', stackTemplateData: context.sampleStackTemplate })
            .expect(200);
        stackTemplates.body.should.be.a('object').that.has.property('name', 'docker-stack-sample1');
        stackTemplates.body.should.be.a('object').that.has.property('data', context.sampleStackTemplate);
    });

    step('create stack template using admin (duplicate)', async () => {
        await supertest(context.server1.app)
            .post('/templates/stacks')
            .set({ Authorization: context.tokenUserAdmin1 })
            .send({ stackTemplateName: 'docker-stack-sample1', stackTemplateData: context.sampleStackTemplate })
            .expect(400);
    });

    step('create stack template using an user', async () => {
        await supertest(context.server1.app)
            .post('/templates/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ stackTemplateName: 'docker-stack-sample1', stackTemplateData: context.sampleStackTemplate })
            .expect(403);
    });

    step('get a stack template using an admin', async () => {
        const stackTemplate = await supertest(context.server1.app)
            .get('/templates/stacks/docker-stack-sample1')
            .set({ Authorization: context.tokenUserAdmin1 })
            .expect(200);
        stackTemplate.body.should.be.an('object').that.has.property('name', 'docker-stack-sample1');
    });

    step('update stack template using an admin', async () => {
        const stackTemplates = await supertest(context.server1.app)
            .put('/templates/stacks')
            .set({ Authorization: context.tokenUserAdmin1 })
            .send({ stackTemplateName: 'docker-stack-sample1', stackTemplateData: context.sampleStackTemplate })
            .expect(200);
        stackTemplates.body.should.be.a('object').that.has.property('name', 'docker-stack-sample1');
        stackTemplates.body.should.be.a('object').that.has.property('data', context.sampleStackTemplate);
    });

    step('update stack template using an user', async () => {
        await supertest(context.server1.app)
            .put('/templates/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ stackTemplateName: 'docker-stack-sample1', stackTemplateData: context.sampleStackTemplate })
            .expect(403);
    });

    step('create stack 1 for user 1', async () => {
        const stackCreationResult = await supertest(context.server1.app)
            .post('/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ stackTemplateName: 'docker-stack-sample1' })
            .expect(200);
        await timeout(5000);
        stackCreationResult.should.not.be.empty;
        stackCreationResult.body.should.not.be.empty;
        stackCreationResult.body.should.have.property('stackName');
        context.stack1 = stackCreationResult.body.stackName;
    });

    step('create stack 2 for user 1', async () => {
        const stackCreationResult = await supertest(context.server1.app)
            .post('/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ stackTemplateName: 'docker-stack-sample1' })
            .expect(200);
        await timeout(5000);
        stackCreationResult.should.not.be.empty;
        stackCreationResult.body.should.not.be.empty;
        stackCreationResult.body.should.have.property('stackName');
        context.stack2 = stackCreationResult.body.stackName;
    });

    step('create stack 3 for user 1 (should not create)', async () => {
        await supertest(context.server1.app)
            .post('/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ stackTemplateName: 'docker-stack-sample1' })
            .expect(400);
    });

    step('get the created stack 1 of user 1', async () => {
        const stackResult = await supertest(context.server1.app)
            .get(`/stacks/${context.stack1}`)
            .set({ Authorization: context.tokenUserUser1 })
            .expect(200);
        stackResult.body.should.not.be.empty;
    });

    step('get the created stack 1 of user 1 from user 2 (should not get)', async () => {
        await supertest(context.server1.app)
            .get(`/stacks/${context.stack1}`)
            .set({ Authorization: context.tokenUserUser2 })
            .expect(404);
    });

    step('get the created stacks from admin', async () => {
        const stackResult = await supertest(context.server1.app)
            .get('/stacks/')
            .set({ Authorization: context.tokenUserAdmin1 })
            .expect(200);
        stackResult.body.should.not.be.empty;
        stackResult.body.should.be.an('array').that.is.not.empty;
    });

    step('delete the created stack 1 of user 1', async () => {
        const stackResult = await supertest(context.server1.app)
            .delete(`/stacks/${context.stack1}`)
            .set({ Authorization: context.tokenUserUser1 })
            .expect(200);
        stackResult.body.should.not.be.empty;
    });

    step('delete the created stack 2 of user 1', async () => {
        const stackResult = await supertest(context.server1.app)
            .delete(`/stacks/${context.stack2}`)
            .set({ Authorization: context.tokenUserUser1 })
            .expect(200);
        stackResult.body.should.not.be.empty;
    });

    step('delete stack template using an user', async () => {
        await supertest(context.server1.app)
            .delete('/templates/stacks/docker-stack-sample1')
            .set({ Authorization: context.tokenUserUser1 })
            .expect(403);
    });

    step('delete stack template using an admin', async () => {
        await supertest(context.server1.app)
            .delete('/templates/stacks/docker-stack-sample1')
            .set({ Authorization: context.tokenUserAdmin1 })
            .expect(200);
    });

    step('try to create a invalid stack for user 1', async () => {
        await supertest(context.server1.app)
            .post('/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .send({ composeTemplateName: 'this-does-not-exist' })
            .expect(400);
    });

    step('get stack template list', async () => {
        const stackTemplates = await supertest(context.server1.app)
            .get('/templates/stacks')
            .set({ Authorization: context.tokenUserUser1 })
            .expect(200);
        stackTemplates.body.should.be.an('array');
    });

    after(async () => {
        await context.dbService.destroy();
        return await context.server1.stop();
    });
});
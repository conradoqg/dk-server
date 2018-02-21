require('mocha-steps');
const chai = require('chai');
const Docker = require('../../lib/docker');
const Chance = require('chance');
const path = require('path');
const should = chai.should();

const chance = new Chance();
const timeout = ms => new Promise(res => setTimeout(res, ms));

describe('Docker', () => {
    const docker = new Docker();
    const userUser = {
        email: chance.email({ domain: 'totvs.com.br' }),
        type: 'user'
    };
    const context = {};

    step('check if it\'s pinging', async () => {
        const pingResult = await docker.ping();
        pingResult.should.be.true;
    });

    step('create a stack for an user', async () => {
        const stackName = await docker.createStack(userUser, path.join(__dirname, 'docker-stack-sample1.yml'));
        should.exist(stackName);
        context.stack1 = { name: stackName };
        await timeout(5000);
    });

    step('get the created stack', async () => {
        const stack = await docker.getStackByName(userUser, context.stack1.name);
        stack.should.be.an('object').that.is.not.empty;
        stack.should.have.property('Name', context.stack1.name);
    });

    step('get all stacks of an user and find it', async () => {
        const stacks = await docker.getStacks(userUser);
        stacks.should.be.an('array').that.is.not.empty;
        stacks.find(stack => stack.Name == context.stack1.name).should.be.an('object');
    });

    step('remove the created stack', async () => {
        const stack = await docker.removeStackByName(userUser, context.stack1.name);
        stack.should.not.have.property('Name', context.stack1.name);
    });

    step('get all stacks of an user and do not find it', async () => {
        const stacks = await docker.getStacks(userUser);
        stacks.should.be.an('array').that.is.empty;
    });
});
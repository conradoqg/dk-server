require('mocha-steps');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const DockerCli = require('../../lib/docker/dockerCli');
const DockerCliError = require('../../lib/docker/dockerCliError');
const path = require('path');
chai.use(chaiAsPromised);
chai.should();

describe('DockerCli', () => {
    const dockerCli = new DockerCli();
    let context = {};

    step('deploy a stack', async (done) => {
        try {
            let deployResult = await dockerCli.deployStack(path.join(__dirname, 'docker-stack-sample1.yml'));
            deployResult.should.be.a('string').that.is.not.empty;
            context.stack1 = {
                name: deployResult
            };
            done();
        } catch (ex) {
            done(ex);
        }
    }).timeout(30000);

    step('check if stack list contains the last created stack', async () => {
        const stackList = await dockerCli.listStacks();
        stackList.should.be.an('array').that.is.not.empty;
        stackList.find(stack => stack.Name == context.stack1.name).should.be.an('object');
    });

    step('remove last created stack', async () => {
        const stackList = await dockerCli.removeStack(context.stack1.name);
        stackList.should.be.true;
    });

    step('prune system', async (done) => {
        try {
            const pruneResult = await dockerCli.pruneSystem();
            pruneResult.should.not.be.empty;
            done();
        } catch (ex) {
            done(ex);
        }
    }).timeout(99999);

    step('remove non-existent stack', async () => {
        await dockerCli.deployStack(path.join(__dirname, 'non-existent-compose-file.yml')).should.be.rejectedWith(DockerCliError);
    });
});
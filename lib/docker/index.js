const DockerAPI = require('./dockerAPI');
const DockerCli = require('./dockerCli');
const fs = require('fs');
const util = require('util');
const tempy = require('tempy');
const yaml = require('js-yaml');
const InvalidOperationError = require('../util/invalidOperationError');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const MAX_SERVICES_PER_USER = 2;
const SERVICE_TYPE = 'dk_stack';

class Docker {
    constructor() {
        this.dockerAPI = new DockerAPI();
        this.dockerCli = new DockerCli();
    }

    async ping() {
        const dockerAPIPingResult = await this.dockerAPI.ping();
        const dockerCliPingResult = await this.dockerCli.ping();
        return dockerAPIPingResult && dockerCliPingResult;
    }

    async createStack(user, composeFile, stackName = null) {

        if (user == null) throw new TypeError('The user argument must be a User object');
        if (composeFile == null) throw new TypeError('The composeFile argument must be a string');
        if (stackName != null && typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string or null');

        const userStacks = await this.getStacks(user);
        let createdStack = null;

        if (userStacks.length <= MAX_SERVICES_PER_USER) {

            const composeContent = await readFile(composeFile, 'utf-8');
            let doc = yaml.safeLoad(composeContent);

            if (doc.services) {
                Object.values(doc.services).map(service => {
                    if (!service.deploy) service.deploy = {};
                    if (!service.deploy.labels) service.deploy.labels = {};
                    service.deploy.labels.email = user.email;
                    service.deploy.labels.type = SERVICE_TYPE;
                });
            }

            const tempFile = tempy.file();
            await writeFile(tempFile, yaml.safeDump(doc));

            createdStack = await this.dockerCli.deployStack(tempFile, stackName);
        } else {
            throw new InvalidOperationError(`Max stacks for user '${user.email}' reached (${MAX_SERVICES_PER_USER})`);
        }

        return createdStack;
    }

    async getStackByName(user, stackName) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string');

        const stacks = await this.getStacks(user, stackName);
        if (stacks.length > 0) return stacks[0];
        else return null;
    }

    async getStacks(user, stackName = null) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (stackName != null && typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string or null');

        const services = await this.getServices(user, stackName);

        let uniqueStackName = [];
        services.map(service => {
            if (service && service.Spec && service.Spec.Labels['com.docker.stack.namespace']) {
                const namespace = service.Spec.Labels['com.docker.stack.namespace'];

                const found = uniqueStackName.find(item => item.name == namespace);
                if (found) {
                    found.services.push(service);
                } else {
                    uniqueStackName.push({
                        Name: namespace,
                        Services: [service]
                    });
                }
            }
        });

        return uniqueStackName;
    }

    async getServices(user, stackName = null) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (stackName != null && typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string or null');

        const labels = [];
        labels.push(`type=${SERVICE_TYPE}`);
        if (user.type != 'admin') labels.push(`email=${user.email}`);
        if (stackName != null) labels.push(`com.docker.stack.namespace=${stackName}`);

        let services = await this.dockerAPI.listServices({
            filters: {
                label: labels
            }
        });

        if (services.length > 0) {
            const tasks = await this.dockerAPI.listTasks(
                {
                    filters: {
                        service: services.map(service => service.ID)
                    }
                });

            if (tasks.length > 0) {
                const nodes = await this.dockerAPI.listNodes(
                    {
                        filters: {
                            id: tasks.map(task => task.NodeID)
                        }
                    });

                services = services.map(service => {
                    const filteredTasks = tasks.filter(task => task.ServiceID == service.ID);

                    service.Tasks = filteredTasks.map(task => {
                        const filteredNodes = nodes.filter(node => task.NodeID == node.ID);
                        if (filteredNodes.length > 0) {
                            task.Node = filteredNodes[0];
                        }
                        return task;
                    });
                    return service;
                });
            }

        }
        return services;
    }

    async removeStackByName(user, stackName) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string');

        const stack = await this.getStackByName(user, stackName);

        const foundStack = stack.Services.find(service => service.Spec && service.Spec.Labels && service.Spec.Labels['com.docker.stack.namespace'] == stackName && (user.type == 'admin' || service.Spec.Labels['email'] == user.email));

        if (foundStack) {
            await this.dockerCli.removeStack(stackName);
        } else {
            return false;
        }

        return true;
    }
}

module.exports = Docker;
const DockerAPI = require('./dockerAPI');
const DockerCli = require('./dockerCli');
const fs = require('fs-extra');
const tempy = require('tempy');
const yaml = require('js-yaml');
const InvalidOperationError = require('../util/invalidOperationError');
const AuthorizationError = require('../auth/authorizationError');

class Docker {
    constructor(maxStacksPerUser = 2, serviceType = 'dk_stack', constraints = null) {
        this.maxStacksPerUser = maxStacksPerUser;
        this.serviceType = serviceType;
        this.constraints = constraints;
        this.dockerAPI = new DockerAPI();
        this.dockerCli = new DockerCli();
    }

    async connect() {
        return await this.dockerAPI.connect();
    }

    async ping() {
        const dockerAPIPingResult = await this.dockerAPI.ping();
        const dockerCliPingResult = await this.dockerCli.ping();
        return dockerAPIPingResult && dockerCliPingResult;
    }

    async createStackByTemplatePath(user, stackTemplatePath, stackName = null) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (stackTemplatePath == null || typeof (stackTemplatePath) != 'string') throw new TypeError('The stackTemplateName argument must be a string');
        if (stackName != null && typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string or null');

        const stackTemplateData = await fs.readFile(stackTemplatePath, 'utf-8');

        return this._createStack(user, stackTemplateData, stackName);
    }

    async createStackByTemplateData(user, stackTemplateData, stackName = null) {
        if (user == null) throw new TypeError('The user argument must be a User object');
        if (stackTemplateData == null || typeof (stackTemplateData) != 'string') throw new TypeError('The stackTemplateData argument must be a string');
        if (stackName != null && typeof (stackName) != 'string') throw new TypeError('The stackName argument must be a string or null');

        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        return this._createStack(user, stackTemplateData, stackName);
    }

    async _createStack(user, stackTemplateData, stackName = null) {
        const userStacks = await this.getStacks(user);
        let createdStack = null;

        if (user.type == 'admin' || (user.type == 'user' && userStacks.length <= this.maxStacksPerUser)) {
            let doc = yaml.safeLoad(stackTemplateData);

            if (doc.services) {
                Object.values(doc.services).map(service => {
                    if (!service.deploy) service.deploy = {};
                    if (!service.deploy.labels) service.deploy.labels = {};
                    service.deploy.labels.email = user.email;
                    service.deploy.labels.type = this.serviceType;
                    if (this.constraints) {
                        if (!service.deploy.placement) service.deploy.placement = {};
                        if (!service.deploy.placement.constraints) service.deploy.placement.constraints = [];
                        service.deploy.placement.constraints = service.deploy.placement.constraints.concat(this.constraints);
                    }
                });
            }

            const tempFile = tempy.file();
            await fs.writeFile(tempFile, yaml.safeDump(doc));

            createdStack = await this.dockerCli.deployStack(tempFile, stackName);
        } else {
            throw new InvalidOperationError(`Max stacks for user '${user.email}' reached (${this.maxStacksPerUser})`);
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
        labels.push(`type=${this.serviceType}`);
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
const Dockerode = require('dockerode');

class DockerAPI {
    constructor() {
        // TODO: Improve security, should try to connect first using socket, then HTTPS (not HTTP)
        this.dockerode = new Dockerode({ protocol: 'http', host: '127.0.0.1', port: 2375 });
    }

    async ping() {
        const pingResult = await this.dockerode.ping();
        return (pingResult == 'OK');
    }

    async listServices(...args) {
        return await this.dockerode.listServices(...args);
    }

    async listTasks(...args) {
        return await this.dockerode.listTasks(...args);
    }

    async listNodes(...args) {
        return await this.dockerode.listNodes(...args);
    }
}

module.exports = DockerAPI;
const Dockerode = require('dockerode');

class DockerAPI {
    constructor() {
    }

    async connect() {        
        try {
            console.log('Trying to connect to docker via socket');
            this.dockerode = new Dockerode();
            await this.ping();
        } catch (ex) {
            try {
                console.log('Trying to connect to docker via https');
                this.dockerode = new Dockerode({ protocol: 'https', host: '127.0.0.1', port: 2375 });
                await this.ping();
            } catch (ex) {
                try {
                    console.log('Trying to connect to docker via http');
                    this.dockerode = new Dockerode({ protocol: 'http', host: '127.0.0.1', port: 2375 });
                    await this.ping();
                } catch (ex) {
                    console.error(`Not able to connect to docker ${JSON.stringify(ex)}`);
                    throw ex;
                }
            }
        }
        console.log('Connected');
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
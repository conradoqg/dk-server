const fs = require('fs-extra');
const path = require('path');

const defaultConfig = {
    maxStacksPerUser: 2,
    serviceType: 'dk_stack'
};

class ConfigDB {
    constructor(path) {
        this.path = path;

        this.createInitialConfigIfNotFound();
    }

    createInitialConfigIfNotFound() {
        fs.ensureDirSync(path.dirname(this.path));
        if (!fs.existsSync(this.path)) fs.writeFileSync(this.path, JSON.stringify(defaultConfig, null, 2));
    }

    async updateConfig(config) {
        await fs.writeFile(this.path, JSON.stringify(config, null, 2));
        return config;
    }

    async getConfig() {
        return JSON.parse(await fs.readFileSync(this.path, 'utf-8'));
    }
}

module.exports = ConfigDB;
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
        if (!fs.exists(this.path)) fs.writeFileSync(this.path, JSON.stringify(defaultConfig));
    }

    async updateConfig(config) {
        return await fs.writeFile(this.path, config);
    }

    async getConfig() {
        return await fs.readFileSync(this.path, 'utf-8');
    }
}

module.exports = ConfigDB;
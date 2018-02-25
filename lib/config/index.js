const AuthorizationError = require('../auth/authorizationError');

class Config {
    constructor(configDB) {
        this.configDB = configDB;
    }

    async getConfig(user) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to do this operation`);

        return await this.configDB.getConfig();
    }

    async updateConfig(user, config) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to do this operation`);

        return this.configDB.updateConfig(config);
    }    
}

module.exports = Config;
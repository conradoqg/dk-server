const AuthorizationError = require('../auth/authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const yaml = require('js-yaml');

class StackTemplate {
    constructor(stackTemplateDB) {
        this.stackTemplateDB = stackTemplateDB;
    }

    async getStackTemplateByName(user, stackTemplateName) {
        return await this.stackTemplateDB.getTemplateByName(stackTemplateName);
    }

    async getStackTemplatePathByName(user, stackTemplateName) {
        return await this.stackTemplateDB.getTemplatePathByName(stackTemplateName);
    }

    async getStackTemplates() {
        return await this.stackTemplateDB.getTemplates();
    }

    async createStackTemplate(user, stackTemplateName, stackTemplateData) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        try {
            yaml.safeLoad(stackTemplateData);
        } catch (ex) {
            throw new InvalidOperationError('Stack data provided is not a valid YAML file');
        }

        return await this.stackTemplateDB.createTemplate(stackTemplateName, stackTemplateData);
    }

    async updateStackTemplate(user, stackTemplateName, stackTemplateData) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        try {
            yaml.safeLoad(stackTemplateData);
        } catch (ex) {
            throw new InvalidOperationError('Stack data provided is not a valid YAML file');
        }

        return await this.stackTemplateDB.updateTemplate(stackTemplateName, stackTemplateData);
    }

    async deleteStackTemplate(user, stackTemplateName) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        return await this.stackTemplateDB.deleteTemplate(stackTemplateName);
    }
}

module.exports = StackTemplate;
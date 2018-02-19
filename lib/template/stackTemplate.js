const AuthorizationError = require('../auth/authorizationError');

class StackTemplateService {
    constructor(dbService) {
        this.stackTemplates = dbService.stackTemplates;
    }

    async getStackTemplatePathByName(stackTemplateName) {
        return await this.stackTemplates.getTemplatePathByName(stackTemplateName);
    }

    async getStackTemplateDataByName(stackTemplateName) {
        return await this.stackTemplates.getTemplateDataByName(stackTemplateName);
    }

    async getStackTemplateByName(stackTemplateName) {
        return await this.stackTemplates.getTemplateByName(stackTemplateName);
    }

    async getStackTemplates() {
        return await this.stackTemplates.getTemplates();
    }

    async createStackTemplate(user, stackTemplateName, stackTemplateData) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        return await this.stackTemplates.createTemplate(stackTemplateName, stackTemplateData);
    }

    async updateStackTemplate(user, stackTemplateName, stackTemplateData) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        return await this.stackTemplates.updateTemplate(stackTemplateName, stackTemplateData);
    }

    async deleteStackTemplate(user, stackTemplateName) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.email}' is not authorized to do this operation`);

        return await this.stackTemplates.deleteTemplate(stackTemplateName);
    }
}

module.exports = StackTemplateService;
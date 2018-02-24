const path = require('path');
const fs = require('fs-extra');
const InvalidOperationError = require('../util/invalidOperationError');

class TemplateDB {
    constructor(path) {
        fs.ensureDirSync(path);
        this.path = path;
    }

    async getTemplateByName(templateName) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (!templatePath == null) throw new InvalidOperationError(`Template ${templateName} does not exist`);

        return {
            name: path.parse(templatePath).name,
            data: await fs.readFile(templatePath, 'utf8')
        };
    }

    async getTemplatePathByName(templateName) {

        const templateList = await fs.readdir(this.path);

        const templateFound = templateList.find(template => template == templateName + '.yml');

        let templatePath = null;
        if (templateFound) templatePath = path.join(this.path, templateFound);

        return templatePath;
    }

    async createTemplate(templateName, templateData) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (templatePath) throw new InvalidOperationError(`Template ${templateName} already exist`);
        else {
            await fs.writeFile(path.join(this.path, templateName + '.yml'), templateData);
        }

        return {
            name: templateName,
            data: templateData
        };
    }

    async updateTemplate(templateName, templateData) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (templatePath) {
            await fs.writeFile(templatePath, templateData);
        } else {
            throw new InvalidOperationError(`Template ${templateName} does not exist`);
        }

        return {
            name: templateName,
            data: templateData
        };
    }

    async deleteTemplate(templateName) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (!templatePath) return false;
        else {
            await fs.unlink(templatePath);
        }

        return true;
    }

    async getTemplates() {
        const templateFileList = await fs.readdir(this.path);

        const templateList = await Promise.all(templateFileList.map(async file => await this.getTemplateByName(path.parse(file).name)));

        return templateList;
    }

    async destroy() {
        return await fs.remove(this.path);
    }
}

module.exports = TemplateDB;
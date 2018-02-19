const fs = require('fs');
const util = require('util');
const path = require('path');
const InvalidOperationError = require('../util/invalidOperationError');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

class TemplateDB {
    constructor(path) {
        this.path = path;
    }

    async getTemplatePathByName(templateName) {

        const templateList = await readdir(this.path);

        const templateFound = templateList.find(template => template == templateName + '.yml');

        let templatePath = null;
        if (templateFound) templatePath = path.join(this.path, templateFound);

        return templatePath;
    }

    async getTemplateDataByName(templateName) {
        const templatePath = await this.getTemplatePathByName(templateName);
        let templateData = null;

        if (templatePath) templateData = await readFile(templatePath);

        return templateData;
    }

    async getTemplateByName(templateName) {
        const templatePath = await this.getTemplatePathByName(templateName);
        let template = null;

        if (templatePath) {
            template = {
                name: templateName,
                data: await readFile(templatePath)
            };
        }

        return template;
    }

    async createTemplate(templateName, templateData) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (templatePath) throw new InvalidOperationError(`Template ${templateName} already exist`);
        else {
            await writeFile(path.join(this.path, templateName + '.yml'), templateData);
        }

        return {
            name: templateName,
            data: templateData
        };
    }

    async updateTemplate(templateName, templateData) {
        const templatePath = await this.getTemplatePathByName(templateName);

        if (templatePath) {
            await writeFile(templatePath, templateData);
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
            await unlink(templatePath);
        }

        return true;
    }

    async getTemplates() {
        const templateFileList = await readdir(this.path);

        const templateList = await Promise.all(templateFileList.map(async file => {
            return { name: path.parse(file).name, data: await readFile(path.join(this.path, file), 'utf8') };
        }));

        return templateList;
    }

    async destroy() {
        const templates = await this.getTemplates();
        const templatesName = templates.map(template => path.parse(template.name).name);
        return await Promise.all(templatesName.map(async templateName => await this.deleteTemplate(templateName)));
    }
}

module.exports = TemplateDB;
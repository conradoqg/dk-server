const PouchDB = require('pouchdb');
const TemplateDB = require('./templateDB');
const ConfigDB = require('./configDB');
const path = require('path');

class DB {
    constructor() {
        this.users = new PouchDB(path.join(__dirname, '../../data/users/'));
        this.stackTemplates = new TemplateDB(path.join(__dirname, '../../data/stackTemplates/'));
        this.config = new ConfigDB(path.join(__dirname, '../../data/config.json'));
    }

    async destroy() {
        await this.users.destroy();
        return await this.stackTemplates.destroy();
    }
}

module.exports = DB;
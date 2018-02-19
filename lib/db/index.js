const PouchDB = require('pouchdb');
const TemplateDB = require('./templateDB');
const path = require('path');

class DB {
    constructor() {
        this.users = new PouchDB('data/users');
        this.stackTemplates = new TemplateDB(path.join(__dirname, '../../stackTemplates/'));
    }

    async destroy() {
        await this.users.destroy();
        return await this.stackTemplates.destroy();
    }
}

module.exports = DB;
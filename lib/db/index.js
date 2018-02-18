const PouchDB = require('pouchdb');

class DB {
    constructor() {
        this.users = new PouchDB('data/users');
    }

    async destroy() {
        return await this.users.destroy();
    }
}

module.exports = DB;
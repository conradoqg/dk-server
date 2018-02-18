const PouchDB = require('pouchdb');

class DB {
    constructor() {
        this.users = new PouchDB('data/users');
    }
}

module.exports = DB;
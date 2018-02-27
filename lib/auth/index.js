const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const HTTPError = require('../httpServer/httpError');
const AuthenticationError = require('./authenticationError');
const AuthorizationError = require('./authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const PasswordPolicy = require('password-sheriff').PasswordPolicy;
const format = require('util').format;
const fs = require('fs-extra');
const LdapAuth = require('ldapauth-fork');

const getSecretFromDocker = () => {
    const secretPath = '/run/secrets/dk-server-secret';
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath);
};

const JWT_SECRET = process.env.JWT_SECRET || getSecretFromDocker() || 'development';
const LENGTH_POLICY = new PasswordPolicy({ length: { minLength: 6 } });

class Auth {
    constructor(userDB, ldapConfig) {
        this.userDB = userDB;
        this.ldapConfig = Array.isArray(ldapConfig) ? ldapConfig : [ldapConfig];
    }

    async authenticateAgainstLDAP(config, name, password) {
        return new Promise((resolve, reject) => {
            const ldapAuth = new LdapAuth(config);
            ldapAuth.on('error', reject);
            ldapAuth.authenticate(name, password, (err, user) => {
                if (err) reject(err);

                ldapAuth.close((err) => {
                    if (err) reject(err);
                    resolve(user);
                });
            });
        });
    }

    async isUsersEmpty() {
        const usersInfo = await this.userDB.info();

        return usersInfo.doc_count == 0;
    }

    async getFirstTimeToken() {
        // This token can be used after the first time to create new admin users
        return jwt.sign({ name: 'master@tokens.ai', type: 'admin' }, JWT_SECRET, { expiresIn: '5h' });
    }

    async createToken(name, password) {
        let token = null;

        const usersResult = await this.userDB.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.name == name);

        // Fist, try to authenticate using LDAP, if authenticated, use the user information found or a basic information
        if (this.ldapConfig) {
            const tries = this.ldapConfig.map(async (config) => {
                try {
                    await this.authenticateAgainstLDAP(config, name, password);
                    token = jwt.sign({ name: resultFound ? resultFound.doc.name : name, type: resultFound ? resultFound.doc.type : 'user' }, JWT_SECRET, { expiresIn: '1d' });
                } catch (ex) {
                    console.debug(`Couldn't authenticate using LDAP: ${ex.message}\n ${ex.stack}`);
                }
            });
            await Promise.all(tries);            
        }

        // If it was not authenticated, try to authenticate against the internal user list
        if (!token) {
            if (resultFound && (name == resultFound.doc.name && bcrypt.compareSync(password, resultFound.doc.password))) {
                token = jwt.sign({ name: resultFound.doc.name, type: resultFound.doc.type }, JWT_SECRET, { expiresIn: '1d' });
            } else {
                throw new AuthenticationError('Invalid username and/or password');
            }
        }

        return token;
    }

    async createUser(user = null, name, password, type) {
        const usersResult = await this.userDB.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.name == name);

        if (resultFound) throw new InvalidOperationError(`The user '${name}' already exists`);

        if (type && type == 'admin' && user && user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to create an admin user`);

        if (this.ldapConfig && (!user || user.type != 'admin')) throw new InvalidOperationError('Cannot create regular users if LDAP is active');

        if (!LENGTH_POLICY.check(password)) throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));

        const newUser = {
            name: name,
            password: bcrypt.hashSync(password, 8),
            type: type || 'user'
        };

        await this.userDB.post(newUser);

        return newUser;
    }

    async updateUser(user, name, password = null, type = null) {
        const usersResult = await this.userDB.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.name == name);

        if (resultFound) {
            const updatedUser = resultFound.doc;

            if (password != null) {
                if (user.name == name) {
                    if (LENGTH_POLICY.check(password)) updatedUser.password = bcrypt.hashSync(password, 8);
                    else throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));
                } else throw new AuthorizationError(`The user '${user.name}' is not authorized to update user '${name}'`);
            }

            if (type != null) {
                if (user.type == 'admin') updatedUser.type = type;
                else throw new AuthorizationError(`The user '${user.name}' is not authorized to update user '${name}'`);
            }

            await this.userDB.put(updatedUser);
        } else {
            throw new InvalidOperationError(`The user '${name}' doesn't exist`);
        }
        return user;
    }

    async getUsers(user) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to list users`);

        const usersResult = await this.userDB.allDocs({ include_docs: true });
        const users = usersResult.rows.map(user => user.doc);
        return users;
    }

    createMiddleware(required = true) {
        return (req, res, next) => {
            if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
                try {
                    req.user = jwt.verify(req.headers['authorization'], JWT_SECRET);
                } catch (err) {
                    throw new HTTPError(403, 'Failed to authenticate token');
                }
            } else if (required) {
                throw new HTTPError(401, 'Authorization header missing');
            }
            next();
        };
    }
}

module.exports = Auth;
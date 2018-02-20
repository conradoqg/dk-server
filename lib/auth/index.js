const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const HTTPError = require('../httpServer/httpError');
const AuthenticationError = require('./authenticationError');
const AuthorizationError = require('./authorizationError');
const InvalidOperationError = require('../util/invalidOperationError');
const PasswordPolicy = require('password-sheriff').PasswordPolicy;
const format = require('util').format;

const JWT_SECRET = process.env.JWT_SECRET || 'development';
const LENGTH_POLICY = new PasswordPolicy({ length: { minLength: 6 } });

class Auth {
    constructor(dbService) {
        this.dbService = dbService;
    }

    async createToken(email, password) {
        let token = null;

        const usersResult = await this.dbService.users.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.email == email);

        if (resultFound) {
            if (email == resultFound.doc.email && bcrypt.compareSync(password, resultFound.doc.password)) {
                token = jwt.sign({ email: resultFound.doc.email, type: resultFound.doc.type }, JWT_SECRET, { expiresIn: '5h' });
            } else {
                throw new AuthenticationError('Invalid username and/or password');
            }
        } else {
            throw new AuthenticationError('Invalid username and/or password');
        }

        return token;
    }

    async createUser(email, password) {        
        const usersResult = await this.dbService.users.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.email == email);

        if (resultFound) throw new InvalidOperationError(`The user '${email}' already exists`);        

        if (!LENGTH_POLICY.check(password)) throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));

        await this.dbService.users
            .post({
                email: email,
                password: bcrypt.hashSync(password, 8),
                type: (email == 'conrado.gomes@totvs.com.br' ? 'admin' : 'user')
            });                

        return true;
    }

    async updateUser(user, email, password = null, type = null) {
        let success = false;
        const usersResult = await this.dbService.users.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.email == email);

        if (resultFound) {
            let update = resultFound;

            if (password != null) {
                if (user.email == email) {
                    if (LENGTH_POLICY.check(password)) update.doc.password = bcrypt.hashSync(password, 8);
                    else throw new InvalidOperationError(format(LENGTH_POLICY.explain()[0].message, LENGTH_POLICY.explain()[0].format));
                } else throw new AuthorizationError(`The user '${user.email}' is not authorized to update user '${email}'`);
            }

            if (type != null) {
                if (user.type == 'admin') update.doc.type = type;
                else throw new AuthorizationError(`The user '${user.email}' is not authorized to update user '${email}'`);
            }

            await this.dbService.users.put(update.doc);
            success = true;
        } else {
            throw new InvalidOperationError(`The user '${email}' doesn't exist`);
        }
        return success;
    }

    middleware(req, res, next) {
        if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
            try {
                req.user = jwt.verify(req.headers['authorization'], JWT_SECRET);
            } catch (err) {
                throw new HTTPError(403, 'Failed to authenticate token');
            }
        } else {
            throw new HTTPError(401, 'Authorization header missing');
        }
        next();
    }
}

module.exports = Auth;
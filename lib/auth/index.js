const HTTPError = require('../httpServer/httpError');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'development';

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
            }
        }

        return token;
    }

    async createUser(email, password) {
        let success = false;
        const usersResult = await this.dbService.users.allDocs({ include_docs: true });
        const resultFound = usersResult.rows.find(item => item.doc.email == email);

        if (!resultFound) {
            await this.dbService.users
                .post({
                    email: email,
                    password: bcrypt.hashSync(password, 8),
                    type: (email == 'conrado.gomes@totvs.com.br' ? 'admin' : 'user')
                });
            success = true;
        }
        return success;
    }

    middleware(req, res, next) {
        if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
            try {
                req.user = jwt.verify(req.headers['authorization'], JWT_SECRET);
            } catch (err) {
                throw new HTTPError(401, 'Failed to authenticate token.');
            }
        } else {
            throw new HTTPError(401, 'Authorization header missing.');
        }
        next();
    }
}

module.exports = Auth;
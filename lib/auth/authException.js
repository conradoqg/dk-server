const ExtendedError = require('../util/extendedError');

class AuthException extends ExtendedError {
    constructor(...args) {
        super(...args);
    }
}

module.exports = AuthException;

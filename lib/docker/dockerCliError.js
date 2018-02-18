const ExtendedError = require('../util/extendedError');

class DockerCliError extends ExtendedError {
    constructor(code, message, context, original) {
        if (!message) message = `Docker exited with code ${code}`;
        super(message, context, original);
        if (code) this.code = code;
    }

    toJSON() {
        const { code } = this;
        return Object.assign({ code }, this);
    }
}

module.exports = DockerCliError;

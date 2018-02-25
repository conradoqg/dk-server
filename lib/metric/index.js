const AuthorizationError = require('../auth/authorizationError');
let metrics = null;

class Metric {
    contructor() {
    }

    getMetrics(user, reset) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to do this operation`);

        return JSON.parse(metrics ? metrics.getAll(reset) : {});
    }

    getMiddleware() {
        metrics = require('express-node-metrics').metrics;
        return require('express-node-metrics').middleware;
    }
}

module.exports = Metric;
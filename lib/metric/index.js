const metricsMiddleware = require('express-node-metrics').middleware;
const metrics = require('express-node-metrics').metrics;
const AuthorizationError = require('../auth/authorizationError');

class Metric {
    contructor() {

    }    

    getMetrics(user, reset) {
        if (user.type != 'admin') throw new AuthorizationError(`The user '${user.name}' is not authorized to do this operation`);

        return JSON.parse(metrics.getAll(reset));
    }

    getMiddleware() {
        return metricsMiddleware;
    }
}

module.exports = Metric;
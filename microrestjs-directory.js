'use strict';

/**
 * Service to register and look up services in a directory.
 *
 * @author Carlos Lozano Sánchez
 * @license MIT
 * @copyright 2015-2016 Carlos Lozano Sánchez
 */

const checkTypes = require('check-types');
const https = require('https');

/**
 * Initializes the service directory.
 *
 * @override
 */
module.exports.onCreateService = function onCreateService() {
    this.registeredServices = {};
};

/**
 * Destroys the service directory.
 *
 * @override
 */
module.exports.onDestroyService = function onDestroyService() {
    this.registeredServices = null;
};

/**
 * Registers services in the directory.
 *
 * NOTE: Service Operation.
 */
module.exports.register = function register(request, response, sendResponse) {
    const requestBody = request.getBody();
    if (checkTypes.not.object(requestBody) || checkTypes.emptyObject(requestBody)) {
        response.setStatus(400);
        sendResponse();
        return;
    }

    const info = requestBody.info;
    if (checkTypes.not.object(info) || checkTypes.emptyObject(info) ||
        checkTypes.not.string(info.name) || checkTypes.emptyString(info.name) ||
        checkTypes.not.integer(info.api) || checkTypes.not.positive(info.api)) {
        response.setStatus(400);
        sendResponse();
        return;
    }

    const port = requestBody.port;
    if (checkTypes.not.integer(port) || checkTypes.not.inRange(port, 1, 65535)) {
        response.setStatus(400);
        sendResponse();
        return;
    }

    const service = {
        info: info,
        location: request.getIp(),
        port: port
    };

    const serviceIdentificationName = `${service.info.name}/v${service.info.api}`;

    const sameServices = this.registeredServices[serviceIdentificationName] || [];

    sameServices.push(service);

    this.registeredServices[serviceIdentificationName] = sameServices;

    response.setStatus(204);
    sendResponse();
};

/**
 * Looks up services in the directory.
 *
 * NOTE: Service Operation.
 */
module.exports.lookup = function lookup(request, response, sendResponse) {
    const serviceIdentificationName = `${request.getPathParameter('serviceName')}/v${request.getPathParameter('api')}`;

    const services = this.registeredServices[serviceIdentificationName];
    if (checkTypes.not.array(services) || checkTypes.emptyArray(services)) {
        response.setStatus(404);
        sendResponse();
        return;
    }

    const callableService = services.shift();
    services.push(callableService);

    _checkAvailability(callableService).then(() => {
        response.setStatus(200).setBody(callableService);
        sendResponse();
    }).catch(() => {
        this.registeredServices[serviceIdentificationName] = this.registeredServices[serviceIdentificationName].filter((element) => {
            return element !== callableService;
        });

        this.lookup(request, response, sendResponse);
    });
};

/**
 * Checks if a service is available.
 *
 * @private
 * @function
 * @param {Object} callableService - CallableService to be checked.
 * @returns {Promise} - Promise that resolves if the service is available and rejects if the service is not available.
 */
function _checkAvailability(callableService) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: callableService.location,
            port: callableService.port,
            path: `/${callableService.info.name}/v${callableService.info.api}/`,
            rejectUnauthorized: false,
            checkServerIdentity: function _checkServerIdentity(host, cert) {
                // The host of the server is not checked.
                // Avoid localhost problems
            }
        };

        https.get(options, (response) => {
            if (response.statusCode === 200) {
                resolve();
            } else {
                reject();
            }
        }).on('error', () => {
            reject();
        });
    });
}

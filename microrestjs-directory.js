'use strict';

/**
 * Service to register and look up services in a directory.
 *
 * @author Carlos Lozano Sánchez
 * @license MIT
 * @copyright 2015 Carlos Lozano Sánchez
 */

var checkTypes = require('check-types');
var https = require('https');

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
    var requestBody = request.getBody();
    if (checkTypes.not.object(requestBody) || checkTypes.emptyObject(requestBody)) {
        response.setStatus(400);
        sendResponse();
        return;
    }

    var info = requestBody.info;
    if (checkTypes.not.object(info) || checkTypes.emptyObject(info) ||
        checkTypes.not.string(info.name) || checkTypes.not.unemptyString(info.name) ||
        checkTypes.not.integer(info.api) || checkTypes.not.positive(info.api)){
        response.setStatus(400);
        sendResponse();
        return;
    }

    var port = requestBody.port;
    if (checkTypes.not.integer(port) || checkTypes.negative(port) || port > 65535){
        response.setStatus(400);
        sendResponse();
        return;
    }

    var service = {
        info: info,
        location: request.getIp(),
        port: port
    };

    var serviceIdentificationName = service.info.name + '/v' + service.info.api;

    var sameServices = this.registeredServices[serviceIdentificationName] || [];

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
    var serviceIdentificationName = request.getPathParameter('serviceName') + '/v' + request.getPathParameter('api');

    var services = this.registeredServices[serviceIdentificationName];
    if (checkTypes.not.assigned(services) || checkTypes.not.array(services) || checkTypes.emptyArray(services)) {
        response.setStatus(404);
        sendResponse();
        return;
    }

    var _this = this;
    var callableService = services.shift();
    services.push(callableService);

    _checkAvailability(callableService, function _checkAvailabilityCallback(isAvailable) {
        if(isAvailable === false) {
            _this.registeredServices[serviceIdentificationName] = _this.registeredServices[serviceIdentificationName].filter(function (element, index, array) {
                return element !== callableService;
            });

            _this.lookup(request, response, sendResponse);
            return;
        }

        response.setStatus(200).setBody(callableService);
        sendResponse();
    });
};

/**
 * Checks if a service is available.
 *
 * @private
 * @function
 * @param {Object} callableService - CallableService to be checked.
 * @param {checkAvailabilityCallback} checkAvailabilityCallback - Callback for delegating the result of checking the service availability.
 */
function _checkAvailability(callableService, checkAvailabilityCallback) {
    var options = {
        hostname: callableService.location,
        port: callableService.port,
        path: '/' + callableService.info.name + '/v' + callableService.info.api + '/',
        rejectUnauthorized: false,
        checkServerIdentity: function _checkServerIdentity(host, cert) {
            //The host of the server is not checked.
            //Avoid localhost problems
        }
    };

    https.get(options, function _responseCallback(response) {
        if (response.statusCode === 200) {
            checkAvailabilityCallback(true);
        } else {
            checkAvailabilityCallback(false);
        }
    }).on('error', function _errorCallback(error) {
        checkAvailabilityCallback(false);
    });
}

/**
 * Callback declaration for delegating the result of checking the service availability.
 *
 * @callback checkAvailabilityCallback
 * @param {Boolean} isAvailable - true, if the service is available; false, otherwise;
 */

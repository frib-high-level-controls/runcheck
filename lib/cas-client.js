/*
 * Central Authentication Service (CAS) support library
 */
var CASClient = require('cas.js');

var log = require('./log');

var cas = {}

cas.create = function (options) {
  cas.client = new CASClient(options);
  return cas.client;
};

cas.validate = function (ticket, cb) {
  if (!cas.client) {
    return log.error('CAS client not created: try calling create()');
  }
  return cas.client.validate(ticket, cb);
};

module.exports = cas;

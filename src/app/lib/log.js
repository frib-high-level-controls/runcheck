/*
 * Simple implementation of the log interface using only stand library.
 */
var util = require('util');

function info() {
  console.info('INFO: ' + util.format.apply(this, arguments));
};

function warn() {
  console.warn('WARN: ' + util.format.apply(this, arguments));
};

function error() {
  console.error('ERROR: ' + util.format.apply(this, arguments));
}

module.exports = {
  info: info,
  warn: warn,
  error: error
}

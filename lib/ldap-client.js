/*
 * LDAP support library
 */
var ldapjs = require('ldapjs');

var log = require('./log');

var ldap = {}

function create(options) {
  ldap.client = ldapjs.createClient(options);
  return ldap.client;
}

ldap.create = create;


function search(base, opts, raw, cb) {
  if (!ldap.client) {
    log.error('LDAP client not created, try calling create()');
    cb(new Error('LDAP client not created'));
    return;
  }
  ldap.client.search(base, opts, function (err, result) {
    if (err) {
      console.log(JSON.stringify(err));
      return cb(err);
    }
    var items = [];
    result.on('searchEntry', function (entry) {
      if (raw) {
        items.push(entry.raw);
      } else {
        items.push(entry.object);
      }
    });
    result.on('error', function (e) {
      console.log(JSON.stringify(e));
      return cb(e);
    });
    result.on('end', function (r) {
      if (r.status !== 0) {
        var e = 'non-zero status from LDAP search: ' + result.status;
        console.log(JSON.stringify(e));
        return cb(e);
      }
      switch (items.length) {
        case 0:
          return cb(null, []);
        default:
          return cb(null, items);
      }
    });
  });
}

ldap.search = search;

module.exports = ldap;

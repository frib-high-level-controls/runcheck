/*
 * Authentication and authorization support using CAS and LDAP
 */
var url = require('url');

var log = require('./log');
var casClient = require('../lib/cas-client');
var ldapClient = require('../lib/ldap-client');

var User = require('../models/user').User;

var debug = require('debug')('runcheck:auth');


function cn(s) {
  var first = s.split(',', 1)[0];
  return first.substr(3).toLowerCase();
}

function filterGroup(a) {
  var output = [];
  var i;
  var group;
  for (i = 0; i < a.length; i += 1) {
    group = cn(a[i]);
    if (group.indexOf('lab.frib') === 0) {
      output.push(group);
    }
  }
  return output;
}

function redirect(req, res) {
  if (req.session.landing && req.session.landing !== '/login') {
    return res.redirect(req.session.landing);
  } else {
    // has a ticket but not landed before
    return res.redirect('/');
  }
}

function ensureAuthenticated(options) {
  var ad = options.ldap;
  var auth = options.auth;
  function doEnsureAuthentication(req, res, next) {
    debug('req.originalUrl: ' + req.originalUrl);
    var ticketUrl = url.parse(req.originalUrl, true);
    if (req.session && req.session.userid) {
      debug('req has a session: ' + req.session.userid);
      // logged in already
      if (req.query.ticket) {
        // remove the ticket query param
        debug('remove ticket ' + req.query.ticket);
        delete ticketUrl.query.ticket;
        return res.redirect(301, url.format({
          pathname: ticketUrl.pathname,
          query: ticketUrl.query
        }));
      }
      next();
    } else if (req.query.ticket) {
      // just kicked back by CAS
      // validate the ticket
      debug('req has a ticket: ' + req.query.ticket);
      casClient.validate(req.query.ticket, function (err, casresponse, result) {
        if (err) {
          log.error(err);
          return res.status(401).send(err.message);
        }
        if (result.validated) {
          debug('ticket ' + req.query.ticket + ' validated');
          var userid = result.username;
          // set userid in session
          req.session.userid = userid;
          var searchFilter = ad.searchFilter.replace('_id', userid);
          var opts = {
            filter: searchFilter,
            attributes: ad.memberAttributes,
            scope: 'sub'
          };

          // query ad about other attribute
          ldapClient.search(ad.searchBase, opts, false, function (err, result) {
            if (err) {
              log.error(err);
              return res.status(500).send('something wrong with ad');
            }
            if (result.length === 0) {
              log.warn('cannot find ' + userid);
              return res.status(500).send(userid + ' is not found!');
            }
            if (result.length > 1) {
              return res.status(500).send(userid + ' is not unique!');
            }

            // set username and memberof in session
            req.session.username = result[0].displayName;
            req.session.memberOf = filterGroup(result[0].memberOf);

            debug('found ' + req.session.userid + ' from AD');
            // load other info from db
            User.findOne({
              adid: userid
            }).exec(function (err, user) {
              if (err) {
                log.error(err);
              }
              if (user) {
                req.session.roles = user.roles;
                // update user last visited on
                User.findByIdAndUpdate(user._id, {
                  lastLoginOn: Date.now()
                }, function (err) {
                  if (err) {
                    log.error(err);
                  }
                  return redirect(req, res);
                });
              } else {
                // create a new user
                var first = new User({
                  adid: userid,
                  name: result[0].displayName,
                  email: result[0].mail,
                  office: result[0].physicalDeliveryOfficeName,
                  phone: result[0].telephoneNumber,
                  mobile: result[0].mobile,
                  lastLoginOn: Date.now()
                });

                first.save(function (err, newUser) {
                  if (err) {
                    log.error(err);
                    log.error(first.toJSON());
                    return res.status(500).send('Cannot create user profile. Please contact admin.');
                  }
                  log.info('A new user created : ' + newUser);
                  req.session.roles = newUser.roles;
                  return redirect(req, res);
                });
              }
            });
          });
        } else {
          log.error('CAS reject this ticket');
          return res.redirect(req.proxied ? auth.login_proxied_service : auth.login_service);
        }
      });
    } else {
      // if this is ajax call, then send 401 without redirect
      if (req.xhr) {
        // TODO: might need to properly set the WWW-Authenticate header
        res.set('WWW-Authenticate', 'CAS realm="' + auth.service + '"');
        return res.status(401).send('xhr cannot be authenticated');
      } else {
        // set the landing, the first unauthenticated url
        req.session.landing = req.originalUrl;
        return res.redirect(auth.cas + '/login?service=' + encodeURIComponent(auth.login_service));
      }
    }
  };
  return doEnsureAuthentication;
};

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
};

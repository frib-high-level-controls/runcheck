var express = require('express');
var users = express.Router();
var debug = require('debug')('runcheck:users');

var ad = require('../../config/config').ad;
var ldapClient = require('../lib/ldap-client');

var User = require('../models/user').User;
var auth = require('../lib/auth');
var authConfig = require('../../config/config').auth;
var log = require('../lib/log');
var reqUtils = require('../lib/req-utils');
var subjects = require('../models/checklist').subjects;

var moment = require('moment');

var fs = require('fs');
var pending_photo = {};
var options = {
  root: __dirname + '/../../user-photos/',
  maxAge: 30 * 24 * 3600 * 1000
};

function cleanList(id, f) {
  var res_list = pending_photo[id];
  delete pending_photo[id];
  res_list.forEach(f);
}

function fetch_photo_from_ad(id) {
  var searchFilter = ad.searchFilter.replace('_id', id);
  var opts = {
    filter: searchFilter,
    attributes: ad.rawAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, true, function (err, result) {
    if (err) {
      log.error(err);
      cleanList(id, function (res) {
        return res.status(500).send('ldap error');
      });
    } else if (result.length === 0) {
      cleanList(id, function (res) {
        return res.status(400).send(id + ' is not found');
      });
    } else if (result.length > 1) {
      cleanList(id, function (res) {
        return res.status(400).send(id + ' is not unique!');
      });
    } else if (result[0].thumbnailPhoto && result[0].thumbnailPhoto.length) {
      if (!fs.existsSync(options.root + id + '.jpg')) {
        fs.writeFile(options.root + id + '.jpg', result[0].thumbnailPhoto, function (fsErr) {
          if (fsErr) {
            log.error(fsErr);
          }
          cleanList(id, function (res) {
            res.set('Content-Type', 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=' + options.maxAge);
            return res.send(result[0].thumbnailPhoto);
          });
        });
      } else {
        cleanList(id, function (res) {
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=' + options.maxAge);
          return res.send(result[0].thumbnailPhoto);
        });
      }
    } else {
      cleanList(id, function (res) {
        return res.status(400).send(id + ' photo is not found');
      });
    }
  });
}

function updateUserProfile(user, res) {
  var searchFilter = ad.searchFilter.replace('_id', user.adid);
  var opts = {
    filter: searchFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, false, function (ldapErr, result) {
    if (ldapErr) {
      return res.status(500).json(ldapErr);
    }
    if (result.length === 0) {
      return res.status(500).json({
        error: user.adid + ' is not found!'
      });
    }
    if (result.length > 1) {
      return res.status(500).json({
        error: user.adid + ' is not unique!'
      });
    }
    user.update({
      name: result[0].displayName,
      email: result[0].mail,
      office: result[0].physicalDeliveryOfficeName,
      phone: result[0].telephoneNumber,
      mobile: result[0].mobile
    }, function (err) {
      if (err) {
        return res.status(500).json(err);
      }
      return res.status(204).end();
    });
  });
}


function addUser(req, res) {
  var nameFilter = ad.nameFilter.replace('_name', req.body.name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (ldapErr, result) {
    if (ldapErr) {
      log.error(ldapErr);
      return res.status(500).json(ldapErr);
    }

    if (result.length === 0) {
      return res.status(404).send(req.body.name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.status(400).send(req.body.name + ' is not unique!');
    }
    var user = new User({
      adid: result[0].sAMAccountName.toLowerCase(),
      name: result[0].displayName,
      email: result[0].mail,
      office: result[0].physicalDeliveryOfficeName,
      phone: result[0].telephoneNumber,
      mobile: result[0].mobile,
      roles: req.body.roles
    });

    user.save(function (err, newUser) {
      if (err) {
        log.error(err);
        return res.status(500).send(err.message);
      }
      var url = authConfig.service + '/users/' + newUser.adid;
      res.set('Location', url);
      return res.status(201).send('The new user is at <a target="_blank" href="' + url + '">' + url + '</a>');
    });

  });
}


users.get('/names/:name', auth.ensureAuthenticated, function (req, res) {
  User.findOne({
    name: req.params.name
  }).exec(function (err, user) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    if (user) {
      return res.render('user', {
        user: user
      });
    }
    return res.status(404).send(req.params.name + ' not found');
  });
});


users.post('/', auth.ensureAuthenticated, auth.verifyRole('admin'), reqUtils.filter('body', ['name']), function (req, res) {
  // check if already in db
  User.findOne({
    name: req.body.name
  }).exec(function (err, user) {
    if (err) {
      return res.status(500).send(err.message);
    }
    if (user) {
      var url = authConfig.service + '/users/' + user.adid;
      return res.status(200).send('The user is at <a target="_blank" href="' + url + '">' + url + '</a>');
    }
    addUser(req, res);
  });

});

users.get('/json', auth.ensureAuthenticated, auth.verifyRole('admin'), function (req, res) {
  User.find().exec(function (err, users) {
    if (err) {
      log.error(err);
      return res.status(500).json({
        error: err.message
      });
    }
    res.json(users);
  });
});

users.get('/:id', auth.ensureAuthenticated, reqUtils.exist('id', User, 'adid'), function (req, res) {
  var user = req[req.params.id];
  user.populate('__updates', function (err, newUser) {
    debug(newUser);
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    return res.render('user', {
      user: newUser,
      subjects: subjects,
      moment: moment
    });
  });
});

users.put('/:id', auth.ensureAuthenticated, auth.verifyRole('admin'), reqUtils.is('json'), reqUtils.filter('body', ['roles', 'expert']), reqUtils.sanitize('body'), reqUtils.exist('id', User, 'adid'), function (req, res) {
  var user = req[req.params.id];
  user.set(req.body);
  user.saveWithHistory(req.session.userid, function (err, newUser) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    if (newUser) {
      newUser.populate('__updates', function (pErr, u) {
        if (pErr) {
          log.error(pErr);
          return res.status(500).send(err.message);
        }
        return res.json(u);
      });
    } else {
      return res.status(200).send('nothing changed.');
    }
  });
});

// get from the db not ad
users.get('/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', User, 'adid'), function (req, res) {
  return res.json(req[req.params.id]);
});

users.get('/:id/refresh', auth.ensureAuthenticated, auth.verifyRole('admin'), reqUtils.exist('id', User, 'adid'), function (req, res) {
  updateUserProfile(req[req.params.id], res);
});

users.get('/:id/photo', auth.ensureAuthenticated, function (req, res) {
  if (fs.existsSync(options.root + req.params.id + '.jpg')) {
    return res.sendFile(req.params.id + '.jpg', options);
  } else {
    return res.sendFile('__unknown__.jpg', options);
  }
  //else if (pending_photo[req.params.id]) {
  //  pending_photo[req.params.id].push(res);
  //} else {
  //  pending_photo[req.params.id] = [res];
  //  fetch_photo_from_ad(req.params.id);
  //}
});


// resource /ad

users.get('/ad/', auth.ensureAuthenticated, function (req, res) {
  return res.status(200).send('Please provide the user ad id');
});

users.get('/ad/:id', auth.ensureAuthenticated, function (req, res) {

  var searchFilter = ad.searchFilter.replace('_id', req.params.id);
  var opts = {
    filter: searchFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      return res.status(500).json(err);
    }
    if (result.length === 0) {
      return res.status(500).json({
        error: req.params.id + ' is not found!'
      });
    }
    if (result.length > 1) {
      return res.status(500).json({
        error: req.params.id + ' is not unique!'
      });
    }

    return res.json(result[0]);
  });

});


users.get('/ad/names/json', auth.ensureAuthenticated, function (req, res) {
  var query = req.query.term;
  var nameFilter;
  var opts;
  if (query && query.length > 0) {
    nameFilter = ad.nameFilter.replace('_name', query + '*');
  } else {
    nameFilter = ad.nameFilter.replace('_name', '*');
  }
  opts = {
    filter: nameFilter,
    attributes: ['displayName'],
    paged: {
      pageSize: 200
    },
    scope: 'sub'
  };
  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      return res.status(500).json(err);
    }
    if (result.length === 0) {
      return res.json([]);
    }
    return res.json(result);
  });
});

module.exports = users;

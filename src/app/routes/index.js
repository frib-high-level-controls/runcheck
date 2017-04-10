var express = require('express');
var index = express.Router();
var auth = require('../lib/auth');
var log = require('../lib/log');
var config = require('../config/config');

/* GET home page. */
index.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

index.get('/login', auth.ensureAuthenticated, function(req, res) {
  if (req.session.userid) {
    return res.redirect('/');
  }
  // something wrong
  res.status(400).send('please enable cookie in your browser');
});

index.get('/logout', function (req, res) {
  if (req.session) {
    req.session.destroy(function (err) {
      if (err) {
        log.error(err);
      }
    });
  }

  res.redirect(config.auth.cas + '/logout');
});

module.exports = index;

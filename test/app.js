var path = require('path');
var express = require('express');
var rotator = require('file-stream-rotator');

var debug = require('debug')('runcheck:test');

var app = express();
var env = app.get('env');

// load configuration start
var config = {}
// load configuration end


// logging start
var log = require('../lib/log');
// logging end


// mongoDB starts
var mongoose = require('mongoose');
mongoose.connection.close();

var mongoOptions = {
  db: {
    native_parser: true
  },
  server: {
    poolSize: 5,
    socketOptions: {
      connectTimeoutMS: 30000,
      keepAlive: 1
    }
  }
};

var mongoDB = 'runcheck_test_' + Math.floor((Math.random()*90000)+10000);

var mongoURL = 'mongodb://localhost:27017/' + mongoDB;

mongoose.Promise = global.Promise;

mongoose.connect(mongoURL, mongoOptions);

mongoose.connection.on('connected', function () {
  log.info('Mongoose default connection opened.');
});

mongoose.connection.on('error', function (err) {
  log.error('Mongoose default connection error: ' + err);
});

mongoose.connection.on('disconnected', function () {
  log.warn('Mongoose default connection disconnected');
});
// mongoDB ends


// authentication start
var auth = require('../lib/auth');

var User = require('../models/user').User;

auth.ensureAuthenticated = function (req, res, next) {
  var userid, header = req.get('Authorization');
  if (header) {
    debug('Authorization: %s', header)
    header = header.split(' ');
    if (header.length >= 2) {
      if (header[0] === 'Basic') {
        header = new Buffer(header[1], 'base64').toString().split(':');
        if (header.length >= 1) {
          debug('Authorization: Basic %s:%s', header[0], header[1]);
          userid = header[0];
        }
      }
    }
  }

  if (!userid) {
    if (!req.session.userid) {
      res.set('WWW-Authenticate', 'Basic realm="RunCheck Test"');
      res.status(401).send('not authenticated');
    } else { 
      next();
    }
    return;
  }

  if (userid === req.session.userid) {
    next();
    return;
  }  

  User.findOne({
     adid:userid
   })
  .then(function (user) {
    req.session.userid = user.adid;
    req.session.roles = user.roles;
    next();
  })
  .catch(function (err) {
    res.set('WWW-Authenticate', 'Basic realm="RunCheck Test"');
    res.status(401).send('not authenticated');
  });
}
// authentication end

// view engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, '../public', 'favicon.ico')));


var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

// session start
var session = require('express-session');

app.use(session({
  store: new session.MemoryStore(),
  resave: false,
  saveUninitialized: false,
  secret: 'secret',
  cookie: {
    maxAge: 28800000,
  },
  logErrors: function (err) {
    log.error(err);
  }
}));
// session end


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'bower_components')));

app.use(auth.sessionLocals);

app.use('/', require('../routes/index'));
app.use('/users', require('../routes/users'));
app.use('/devices', require('../routes/devices'));
app.use('/slots', require('../routes/slots'));
app.use('/slotgroups', require('../routes/slot-groups'));
app.use('/checklists', require('../routes/checklists'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
app.use(function (err, req, res) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: err
  });
});


module.exports = app;

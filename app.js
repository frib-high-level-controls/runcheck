var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var rotator = require('file-stream-rotator');
var bodyParser = require('body-parser');

var session = require('express-session');
var RedisStore = require('connect-redis')(session);



logger.token('remote-user', function (req) {
  if (req.session && req.session.userid) {
    return req.session.userid;
  } else {
    return 'unknown';
  }
});
// load configuration start
var config = require('./config/config');
config.ad = require('./config/ad');
config.app = require('./config/app');
config.auth = require('./config/auth');
config.mongo = require('./config/mongo');
config.redis = require('./config/redis');

// ensure log directory is an absolute path
config.app.log_dir = path.resolve(__dirname, './config', config.app.log_dir || '../logs/');
// load configuration end


// bunyan logging start
var log = require('./lib/log');
var bunyan = require('bunyan');
var bunyanLogger = bunyan.createLogger({
 name: 'runcheck',
 streams: [{
        type: 'stream',
        stream: process.stderr
    },{
        type: 'rotating-file',
        path: path.join(config.app.log_dir, 'runcheck.log'),
        period: '1d',   // daily rotation
        count: 3        // keep 3 back copies
    }]
});
log.info = bunyanLogger.info.bind(bunyanLogger);
log.warn = bunyanLogger.warn.bind(bunyanLogger);
log.error = bunyanLogger.error.bind(bunyanLogger);
// bunyan logging end


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

var mongoURL = 'mongodb://' + (config.mongo.address || 'localhost') + ':' + (config.mongo.port || '27017') + '/' + (config.mongo.db || 'runcheck');

if (config.mongo.user && config.mongo.pass) {
  mongoOptions.user = config.mongo.user;
  mongoOptions.pass = config.mongo.pass;
}

if (config.mongo.auth) {
  mongoOptions.auth = config.mongo.auth;
}

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

// mongoose models start
require('./models/user');
// mongoose models end


// ldap client starts
var adClient = require('./lib/ldap-client').client;
adClient.on('connect', function () {
  log.info('ldap client connected');
});
adClient.on('timeout', function (message) {
  log.warn(message);
});
adClient.on('error', function (error) {
  log.error(error);
});
// ldap client ends

// redis store starts
var redisStore = new RedisStore(config.redis);
redisStore.on('connect', function () {
  log.info('redis connected');
});

redisStore.on('disconnect', function (err) {
  log.warn('redis disconnected');
  if (err) {
    log.error(err);
  }
});
// redis store ends


var index = require('./routes/index');
var users = require('./routes/users');
var devices = require('./routes/devices');
var slots = require('./routes/slots');
var slotGroups = require('./routes/slot-groups');
var checklists = require('./routes/checklists');
var auth = require('./lib/auth');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

if (app.get('env') === 'production') {
  var logStream = rotator.getStream({
    filename: path.resolve(config.app.log_dir, 'access.log'),
    frequency: 'daily'
  });
  app.use(logger('combined', {
    stream: logStream
  }));
}

if (app.get('env') === 'development') {
  app.use(logger('dev'));
}
// app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(session({
  store: redisStore,
  resave: false,
  saveUninitialized: false,
  secret: config.app.session_sec || 'secret',
  cookie: {
    maxAge: config.app.session_life || 28800000
  },
  logErrors: function (err) {
    log.error(err);
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'bower_components')));

app.use(auth.sessionLocals);

app.use('/', index);
app.use('/users', users);
app.use('/devices', devices);
app.use('/slots', slots);
app.use('/slotgroups', slotGroups);
app.use('/checklists', checklists);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;

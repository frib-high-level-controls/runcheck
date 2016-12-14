var path = require('path');
var express = require('express');
var rotator = require('file-stream-rotator');

var app = express();
var env = app.get('env');

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

// CAS client start
var casClientFactory = require('./lib/cas-client');
casClientFactory.create({
  base_url: config.auth.cas,
  service: config.auth.login_service,
  version: 1.0
});
// CAS client end


// LDAP client start
var ldapClientFactory = require('./lib/ldap-client');

var ldapClient = ldapClientFactory.create({
  url: config.ad.url,
  paging: true,
  timeout: 15 * 1000,
  reconnect: true,
  bindDN: config.ad.adminDn,
  bindCredentials: config.ad.adminPassword
});

ldapClient.on('connect', function () {
  log.info('ldap client connected');
});

ldapClient.on('timeout', function (message) {
  log.warn(message);
});

ldapClient.on('error', function (error) {
  log.error(error);
});
// LDAP client ends


// authentication start
var auth = require('./lib/auth');
var casLdapAuth = require('./lib/cas-ldap-auth');
auth.ensureAuthenticated = casLdapAuth.ensureAuthenticated({
  ldap: config.ad,
  auth: config.auth
});
// authentication end

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// morgan start
var morgan = require('morgan');
morgan.token('remote-user', function (req) {
  if (req.session && req.session.userid) {
    return req.session.userid;
  } else {
    return 'unknown';
  }
});

if (env === 'production') {
  app.use(morgan('combined', {
    stream: rotator.getStream({
      filename: path.resolve(config.app.log_dir, 'access.log'),
      frequency: 'daily'
    })
  }));
}

if (env === 'development') {
  app.use(morgan('dev'));
}
// morgan end


var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

// session start
var session = require('express-session');

var RedisStore = require('connect-redis')(session);

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
// session end


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'bower_components')));

app.use(auth.sessionLocals);

app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/devices', require('./routes/devices'));
app.use('/slots', require('./routes/slots'));
app.use('/slotgroups', require('./routes/slot-groups'));
app.use('/checklists', require('./routes/checklists'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (env === 'development') {
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


import fs = require('fs');
import path = require('path');

import bodyparser = require('body-parser');
import express = require('express');
import favicon = require('serve-favicon');
import morgan = require('morgan');
import session = require('express-session');
import mongoose = require('mongoose');

import handlers = require('./shared/handlers');
import status = require('./shared/status');
import auth = require('./lib/auth');
import casLdapAuth = require('./lib/cas-ldap-auth');
import casClientFactory = require('./lib/cas-client.js');
import ldapClientFactory = require('./lib/ldap-client');

import index_routes = require('./routes/index');
import users_routes = require('./routes/users');
import devices_routes = require('./routes/devices');
import slots_routes = require('./routes/slots');
import slot_groups_routes = require('./routes/slot-groups');
import checklists_routes = require('./routes/checklists');


// error interface
interface StatusError extends Error {
  status?: number;
}

// application configuration
interface AppCfg {
  port?: string;
  addr?: string;
  session_life?: number;
  session_secret?: string;
};

// MongoDB configuration
interface MongoCfg {
  address?: string;
  port?: number | string;
  db?: string;
  options?: any;
};

// Authentication configuration
interface AuthCfg {
  cas: string;
  service: string;
  login_service: string;
};

// LDAP configuration
interface LdapCfg {
  url: string;
  adminDn: string;
  adminPassword: string;
};

// application singleton
let app: express.Application;

// application logging
let log = console.log;
let warn = console.warn;
let error = console.error;

// application lifecycle
let state = 'stopped';

// application activity
let activeCount = 0;
let activeLimit = 100;
let activeStopped = Promise.resolve();

function updateActivityStatus(): void {
  if (activeCount <= activeLimit) {
    status.setComponentOk('Activity', activeCount + ' <= ' + activeLimit);
  } else {
    status.setComponentError('Activity', activeCount + ' > ' + activeLimit);
  }
};

// read configuration file in JSON format
async function readConfigFile(name: string): Promise<object> {
  return new Promise(function (resolve, reject) {
    fs.readFile(path.resolve(path.resolve(__dirname, '../config', name)), 'utf8', function (err, data) {
      if (err) {
        reject(err);
        return;
      }
      resolve(JSON.parse(data));
    });
  });
};

// asynchronously start the application
async function start(): Promise<express.Application> {
  if (state !== 'stopped') {
    throw new Error('Application must be in "stopped" state');
  }

  let activeFinished: () => void;

  state = 'starting';
  log('Application starting');

  activeCount = 0;
  activeStopped = new Promise<void>(function (resolve) {
    activeFinished = resolve;
  });

  updateActivityStatus();

  app = express();

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (state !== 'started') {
      res.status(503).end('application ' + state);
      return;
    }
    res.on('finish', () => {
      activeCount -= 1;
      updateActivityStatus();
      if (state === 'stopping' && activeCount <= 0) {
        activeFinished();
      }
    });
    activeCount += 1;
    updateActivityStatus();
    next();
  });

  try {
    await doStart();
  } catch (err) {
    try {
      await stop();
    } catch (ierr) {
      /* ignore */
    }
    throw err;
  }

  log('Application started');
  state = 'started';
  return app;
};


// asynchronously configure the application
async function doStart(): Promise<void> {
  let env = app.get('env');

  // Connect to MongoDB
  let mongoCfg: MongoCfg = await readConfigFile('mongo.json');

  let mongoUrl = 'mongodb://' + (mongoCfg.address || 'localhost')
                              + ':' + (mongoCfg.port || '27017')
                              + '/' + (mongoCfg.db || 'runcheck-dev');

  let mongoOptions = mongoCfg.options || {};

  mongoose.Promise = global.Promise;

  mongoose.connection.on('connected', function() {
    status.setComponentOk('MongoDB', 'Connected');
    log('Mongoose default connection opened.');
  });

  mongoose.connection.on('disconnected', function() {
    status.setComponentError('MongoDB', 'Disconnected');
    log('Mongoose default connection disconnected');
  });

  mongoose.connection.on('error', function(err: any) {
    status.setComponentError('MongoDB', err.message || 'Unknown Error');
    log('Mongoose default connection error: ' + err);
  });

  status.setComponentError('MongoDB', 'Never Connected');

  mongoose.connect(mongoUrl, mongoOptions);

  // Authentication configuration
  let [ authCfg, ldapCfg ] = await Promise.all([
    <Promise<AuthCfg>> readConfigFile('auth.json'),
    <Promise<LdapCfg>> readConfigFile('ad.json'),
  ]);

  // CAS client start
  casClientFactory.create({
    base_url: authCfg.cas,
    service: authCfg.login_service,
    version: 1.0,
  });

  // LDAP client start
  let ldapClient = ldapClientFactory.create({
    url: ldapCfg.url,
    paging: true,
    timeout: 15 * 1000,
    reconnect: true,
    bindDN: ldapCfg.adminDn,
    bindCredentials: ldapCfg.adminPassword,
  });

  status.setComponentError('LDAP', 'Never Connected');

  ldapClient.on('connect', function() {
    status.setComponentOk('LDAP', 'Connected');
    log('LDAP client connected');
  });

  ldapClient.on('timeout', function(message: string) {
    status.setComponentError('LDAP', 'Timeout');
    warn(message);
  });

  ldapClient.on('error', function(err: any) {
    status.setComponentError('LDAP', err.message || 'ERROR');
    error(err);
  });

  auth.ensureAuthcHandler = casLdapAuth.ensureAuthenticated({
    ldap: ldapCfg,
    auth: authCfg,
  });


  let appCfg: AppCfg = await readConfigFile('app.json');

  app.set('port', appCfg.port || '3000');
  app.set('addr', appCfg.addr || 'localhost');

  // view engine configuration
  app.set('views', path.resolve(__dirname, '../views'));
  app.set('view engine', 'pug');

  // favicon configuration
  app.use(favicon(path.resolve(__dirname, '../public', 'favicon.ico')));

  // morgan configuration
  morgan.token('remote-user', function (req) {
    if (req.session && req.session.userid) {
      return req.session.userid;
    } else {
      return 'unknown';
    }
  });

  if (env === 'production') {
    app.use(morgan('short'));
  } else {
    app.use(morgan('dev'));
  }

  // body-parser configuration
  app.use(bodyparser.json());
  app.use(bodyparser.urlencoded({
    extended: false,
  }));

  // session configuration
  app.use(session({
    store: new session.MemoryStore(),
    resave: false,
    saveUninitialized: false,
    secret: appCfg.session_secret || 'secret',
    cookie: {
      maxAge: appCfg.session_life || 28800000,
    },
  }));

  app.use(express.static(path.resolve(__dirname, '../public')));
  app.use(express.static(path.resolve(__dirname, '../bower_components')));

  app.use(auth.sessionLocals);

  app.use('/status', status.router);
  app.use('/', index_routes);
  app.use('/users', users_routes);
  app.use('/devices', devices_routes);
  app.use('/slots', slots_routes);
  app.use('/slotgroups', slot_groups_routes);
  app.use('/checklists', checklists_routes);

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    let err: StatusError = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handlers
  app.use(handlers.requestErrorHandler);
};

// asynchronously stop the application
async function stop(): Promise<void> {
  if (state !== 'started') {
    throw new Error('Application must be in "started" state');
  }

  state = 'stopping';
  log('Application stopping');

  if (activeCount > 0) {
    log('Waiting for active requests to stop');
    await activeStopped;
  }

  try {
    await doStop();
  } finally {
    log('Application stopped');
    state = 'stopped';
  }
};

// asynchronously disconnect the application
async function doStop(): Promise<void> {
  log('Application stopping');

  // Disconnect MongoDB
  mongoose.disconnect();

  return;
}

export { start, stop, log, warn, error };


import fs = require('fs');
import path = require('path');

import bodyparser = require('body-parser');
import express = require('express');
import favicon = require('serve-favicon');
import morgan = require('morgan');
import session = require('express-session');
import mongoose = require('mongoose');

import monitor = require('./shared/monitor');

import monitor_routes = require('./routes/monitor');
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
interface IAppCfg {
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

// application singleton
let app: express.Application;

// application logging
let log = console.log;
let warn = console.warn;
let error = console.error;

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

// Asynchronously start the application
async function start(): Promise<express.Application> {
  if (app) {
    return app;
  }

  log('Application starting');

  app = express();
  let env = app.get('env');

  // Connect to MongoDB
  let mongoCfg: MongoCfg = await readConfigFile('mongo.json');

  let mongoUrl = 'mongodb://' + (mongoCfg.address || 'localhost')
                              + ':' + (mongoCfg.port || '27017')
                              + '/' + (mongoCfg.db || 'runcheck-dev');

  let mongoOptions = mongoCfg.options || {};

  mongoose.Promise = global.Promise;

  mongoose.connection.on('connected', function() {
    log('Mongoose default connection opened.');
  });

  mongoose.connection.on('disconnected', function() {
    log('Mongoose default connection disconnected');
  });

  mongoose.connection.on('error', function(err) {
    log('Mongoose default connection error: ' + err);
  });

  mongoose.connect(mongoUrl, mongoOptions);


  let cfg: IAppCfg = await readConfigFile('app.json');

  app.set('port', cfg.port || '3000');
  app.set('addr', cfg.addr || 'localhost');

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
    secret: cfg.session_secret || 'secret',
    cookie: {
      maxAge: cfg.session_life || 28800000,
    },
    logErrors: function(err) {
      // log.error(err);
    },
  }));

  app.use(express.static(path.resolve(__dirname, '../public')));
  app.use(express.static(path.resolve(__dirname, '../bower_components')));

  app.use('/monitor', monitor_routes);
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
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });

  log('Application started');

  return app;
};


// Asynchronously start the application
async function stop(): Promise<void> {
  log('Application stopping');

  // Disconnect MongoDB
  mongoose.disconnect();

  log('Application stopped');
  return;
}

export { start, stop, log, warn, error };

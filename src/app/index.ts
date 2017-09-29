
import fs = require('fs');
import path = require('path');

import rc = require('rc');
import bodyparser = require('body-parser');
import express = require('express');
import favicon = require('serve-favicon');
import mongoose = require('mongoose');
import morgan = require('morgan');
import session = require('express-session');

import handlers = require('./shared/handlers');
import logging = require('./shared/logging');
import status = require('./shared/status');
import auth = require('./shared/auth');
import cfauth = require('./shared/cas-forg-auth');
import forgapi = require('./shared/forgapi');

import users_routes = require('./routes/users');
import devices_routes = require('./routes/devices');
import slots_routes = require('./routes/slots');
import slot_groups_routes = require('./routes/slot-groups');
import checklists_routes = require('./routes/checklists');


// package metadata
interface Package {
  name?: {};
  version?: {};
};

// application configuration
interface Config {
  // these properties are provided by the 'rc' library
  // and contain config file paths that have been read
  // (see https://www.npmjs.com/package/rc)
  config?: string;
  configs?: string[];
  app: {
    port: {};
    addr: {};
    session_life: {};
    session_secret: {};
  };
  mongo: {
    user?: {};
    pass?: {};
    port: {};
    addr: {};
    db: {};
    options: {};
  };
  cas: {
    cas_url?: {};
    service_url?: {};
    append_path?: {};
    version?: {};
  };
  forgapi: {
    url?: {};
    agentOptions?: {};
  };
};

// application singleton
let app: express.Application;

// application logging
let log = logging.log;
let info = logging.info;
let warn = logging.warn;
let error = logging.error;

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

// read file with path resolution
function readFile(...pathSegments: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(...pathSegments), (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

// read the application name and version
async function readNameVersion(): Promise<[string | undefined, string | undefined]> {
  // first look for application name and version in the environment
  let name = process.env.NODE_APP_NAME;
  let version = process.env.NODE_APP_VERSION;
  // second look for application name and verison in packge.json
  if (!name || !version) {
    try {
      let data = await readFile(__dirname, '..', 'package.json');
      let pkg: Package = JSON.parse(data.toString('UTF-8'));
      if (!name && pkg && pkg.name) {
        name = String(pkg.name);
      }
      if (!version && pkg && pkg.version) {
        version = String(pkg.version);
      }
    } catch (ierr) {
      // ignore //
    }
  }
  return [name, version];
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

  let [name, version] = await readNameVersion();
  app.set('name', name);
  app.set('version', version);

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
  let env: {} | undefined = app.get('env');
  let name: {} | undefined = app.get('name');

  let cfg: Config = {
    app: {
      port: '3000',
      addr: 'localhost',
      session_life: 28800000,
      session_secret: 'secret',
    },
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'webapp-dev',
      options: {
        // see http://mongoosejs.com/docs/connections.html
        useMongoClient: true,
      },
    },
    cas: {
      // no defaults
    },
    forgapi: {
      // no defaults
    },
  };

  if (name && (typeof name === 'string')) {
    rc(name, cfg);
    if (cfg.configs) {
      for (let file of cfg.configs) {
        log('Load configuration: %s', file);
      }
    }
  }

  app.set('port', String(cfg.app.port));
  app.set('addr', String(cfg.app.addr));

  // configure Mongoose (MongoDB)
  let mongoUrl = 'mongodb://';
  if (cfg.mongo.user) {
    mongoUrl += encodeURIComponent(String(cfg.mongo.user));
    if (cfg.mongo.pass) {
      mongoUrl += ':' + encodeURIComponent(String(cfg.mongo.pass));
    }
    mongoUrl += '@';
  }
  mongoUrl += cfg.mongo.addr + ':' + cfg.mongo.port + '/' + cfg.mongo.db;

  mongoose.Promise = global.Promise;

  mongoose.connection.on('connected', () => {
    status.setComponentOk('MongoDB', 'Connected');
    log('Mongoose default connection opened.');
  });

  mongoose.connection.on('disconnected', () => {
    status.setComponentError('MongoDB', 'Disconnected');
    warn('Mongoose default connection closed');
  });

  mongoose.connection.on('error', (err) => {
    status.setComponentError('MongoDB', err.message || 'Unknown Error');
    error('Mongoose default connection error: %s', err);
  });

  status.setComponentError('MongoDB', 'Never Connected');
  log('Mongoose default connection: %s', mongoUrl);
  await mongoose.connect(mongoUrl, cfg.mongo.options);

  // Authentication configuration
  if (!cfg.forgapi.url) {
    throw new Error('FORG base URL not configured');
  }
  log('FORG API base URL: %s', cfg.forgapi.url);

  const forgClient = new forgapi.Client({
    url: String(cfg.forgapi.url),
    agentOptions: cfg.forgapi.agentOptions || {},
  });
  // Need the FORG base URL available to views
  app.locals.forgurl = String(cfg.forgapi.url);

  if (!cfg.cas.cas_url) {
    throw new Error('CAS base URL not configured');
  }
  log('CAS base URL: %s', cfg.cas.cas_url);

  if (!cfg.cas.service_url) {
    throw new Error('CAS service URL not configured');
  }
  log('CAS service URL: %s, (append path: %s)', cfg.cas.service_url, cfg.cas.append_path);

  const cfAuthProvider = new cfauth.CasForgProvider(forgClient, {
    casUrl: String(cfg.cas.cas_url),
    casServiceUrl: String(cfg.cas.service_url),
    casAppendPath: cfg.cas.append_path === true ? true : false,
    casVersion: cfg.cas.version ? String(cfg.cas.version) : undefined,
  });

  auth.setProvider(cfAuthProvider);

  // view engine configuration
  app.set('views', path.resolve(__dirname, '..', 'views'));
  app.set('view engine', 'pug');
  app.set('view cache', (env === 'production') ? true : false);

  // favicon configuration
  app.use(favicon(path.resolve(__dirname, '..', 'public', 'favicon.ico')));

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
    secret: String(cfg.app.session_secret),
    cookie: {
      maxAge: Number(cfg.app.session_life),
    },
  }));

  // app.use(auth.sessionLocals);
  app.use(express.static(path.resolve(__dirname, '..', 'public')));
  app.use(express.static(path.resolve(__dirname, '..', 'bower_components')));

  // authentication handlers
  app.use(cfAuthProvider.initialize());

  app.get('/login', cfAuthProvider.authenticate(), (req, res) => {
    if (req.query.bounce) {
      res.redirect(req.query.bounce);
      return;
    }
    res.redirect('/');
  });

  app.get('/logout', (req, res) => {
    cfAuthProvider.logout(req);
    const redirectUrl = cfAuthProvider.getCasLogoutUrl(true);
    log('Redirect to CAS logout: %s', redirectUrl);
    res.redirect(redirectUrl);
  });

  app.get('/', (req, res) => {
    res.render('index');
  });

  app.use('/status', status.router);
  app.use('/users', users_routes);
  app.use('/devices', devices_routes.router);
  app.use('/slots', slots_routes);
  app.use('/slotgroups', slot_groups_routes);
  app.use('/checklists', checklists_routes.router);

  // no handler found for request (404)
  app.use(handlers.notFoundHandler);

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
  // disconnect Mongoose (MongoDB)
  try {
    await mongoose.disconnect();
  } catch (err) {
    warn('Mongoose disconnect failure: %s', err);
  }
  return;
}

export { start, stop, log, error };

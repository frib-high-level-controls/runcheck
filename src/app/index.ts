/**
 * Start and configure the web application.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as util from 'util';

// Required syntax because the type declaration uses 'export = rc;'.
// (See: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/rc/index.d.ts)
import rc = require('rc');

import * as bodyparser from 'body-parser';
import * as express from 'express';
import * as session from 'express-session';
import * as mongoose from 'mongoose';
import * as morgan from 'morgan';
import * as favicon from 'serve-favicon';

import * as auth from './shared/auth';
import * as forgauth from './shared/forg-auth';
import * as handlers from './shared/handlers';
import * as logging from './shared/logging';
import * as promises from './shared/promises';
import * as status from './shared/status';
import * as tasks from './shared/tasks';

import * as ldapauth from './lib/ldap-auth';
import * as forgapi from './lib/ldap-forgapi';
import * as ldapjs from './lib/ldapjs-client';
import * as migrations from './lib/migrations';

import * as api1 from './routes/api1';
import * as api2 from './routes/api2';
import * as checklists from './routes/checklists';
import * as devices from './routes/devices';
import * as groups from './routes/groups';
import * as slots from './routes/slots';
import * as views from './routes/views';


// package metadata
interface Package {
  name?: {};
  version?: {};
}

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
    trust_proxy: {};
    session_life: {};
    session_secret: {};
    admin_roles: {};
  };
  mongo: {
    user?: {};
    pass?: {};
    host?: {};
    port: {};
    addr: {};
    db: {};
    options: {};
  };
  ldap: {
    url?: {};
    bindDN?: {};
    password?: {};
    tlsOptions?: {};
    strictDN?: {},
    timeout?: {};
    idleTimeout?: {};
    connectTimeout?: {};
    reconnect?: {};
  };
  forgapi: {
    userSearch?: {
      base?: {};
      filter?: {};
    };
    groupSearch?: {
      base?: {};
      filter?: {};
    };
    userAttributes?: {};
    groupAttributes?: {};
  };
}

// application states (same as tasks.State, but avoids the dependency)
export type State = 'STARTING' | 'STARTED' | 'STOPPING' | 'STOPPED';

// application singleton
let app: express.Application;

// LDAP Search connection
let ldapSearchClient: ldapjs.Client | null = null;

// LDAP Bind connection (Bind requests use dedicated connection)
// (see details: https://github.com/vesse/node-ldapauth-fork)
let ldapBindClient: ldapjs.Client | null = null;

// application logging
export let info = logging.info;
export let warn = logging.warn;
export let error = logging.error;

// application lifecycle
const task = new tasks.StandardTask<express.Application>(doStart, doStop);

// application activity
const activeLimit = 100;
const activeResponses = new Set<express.Response>();
const activeSockets = new Set<net.Socket>();
let activeFinished = Promise.resolve();

const readFile = util.promisify(fs.readFile);

// read the application name and version
async function readNameVersion(): Promise<[string | undefined, string | undefined]> {
  // first look for application name and version in the environment
  let name = process.env.NODE_APP_NAME;
  let version = process.env.NODE_APP_VERSION;
  // second look for application name and verison in package.json
  if (!name || !version) {
    const pkgPath = path.resolve(__dirname, 'version.json');
    let pkg: Package | undefined;
    try {
      pkg = JSON.parse(await readFile(pkgPath, 'UTF-8'));
    } catch (err) {
      warn('Missing or invalid package metadata: %s: %s', pkgPath, err);
    }
    if (!name && pkg && pkg.name) {
      name = String(pkg.name);
    } else {
      name = String(name);
    }
    if (!version && pkg && pkg.version) {
      version = String(pkg.version);
    } else {
      version = String(version);
    }
  }
  return [name, version];
}

// get the application state
export function getState(): State {
  return task.getState();
}

// asynchronously start the application
export function start(): Promise<express.Application> {
  return task.start();
}

// asynchronously configure the application
async function doStart(): Promise<express.Application> {

  info('Application starting');

  app = express();

  const [name, version] = await readNameVersion();
  app.set('name', name);
  app.set('version', version);

  activeSockets.clear();
  activeResponses.clear();

  function updateActivityStatus(): void {
    if (activeResponses.size <= activeLimit) {
      status.setComponentOk('Activity', activeResponses.size + ' <= ' + activeLimit);
    } else {
      status.setComponentError('Activity', activeResponses.size + ' > ' + activeLimit);
    }
  }

  activeFinished = new Promise((resolve) => {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (task.getState() !== 'STARTED') {
        res.status(503).end('Application ' + task.getState());
        return;
      }

      if (!activeResponses.has(res)) {
        activeResponses.add(res);
        updateActivityStatus();
        res.on('finish', () => {
          if (!activeResponses.delete(res)) {
            warn('Response is NOT active!');
          }
          updateActivityStatus();
          if (task.getState() === 'STOPPING' && activeResponses.size <= 0) {
            resolve();
          }
        });
      } else {
        warn('Response is ALREADY active!');
      }

      const socket = res.connection;
      if (!activeSockets.has(socket)) {
        activeSockets.add(socket);
        socket.on('close', () => {
          if (!activeSockets.delete(socket)) {
            warn('Socket is NOT active!');
          }
        });
      }

      next();
    });
  });

  const env: {} | undefined = app.get('env');
  info('Deployment environment: \'%s\'', env);

  const cfg: Config = {
    app: {
      port: '3000',
      addr: 'localhost',
      trust_proxy: false,
      session_life: 3600000,
      session_secret: crypto.randomBytes(50).toString('base64'),
      admin_roles: [ 'ADM:RUNCHECK', 'ADM:CCDB' ],
    },
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'webapp-dev',
      options: {
        // see http://mongoosejs.com/docs/connections.html
        useNewUrlParser: true,
      },
    },
    ldap: {
      // no defaults
    },
    forgapi: {
      // no defaults
    },
  };

  if (name && (typeof name === 'string')) {
    rc(name, cfg);
    if (cfg.configs) {
      for (const file of cfg.configs) {
        info('Load configuration: %s', file);
      }
    }
  }

  app.set('port', String(cfg.app.port));
  app.set('addr', String(cfg.app.addr));

  // Proxy configuration (https://expressjs.com/en/guide/behind-proxies.html)
  app.set('trust proxy', cfg.app.trust_proxy || false);

  // Status monitor start
  await status.monitor.start();
  info('Status monitor started');

  // configure Mongoose (MongoDB)
  let mongoUrl = 'mongodb://';
  if (cfg.mongo.user) {
    mongoUrl += encodeURIComponent(String(cfg.mongo.user));
    if (cfg.mongo.pass) {
      mongoUrl += ':' + encodeURIComponent(String(cfg.mongo.pass));
    }
    mongoUrl += '@';
  }
  if (!cfg.mongo.host) {
    cfg.mongo.host = `${cfg.mongo.addr}:${cfg.mongo.port}`;
  }
  mongoUrl +=  `${cfg.mongo.host}/${cfg.mongo.db}`;

  // Remove password from the MongoDB URL to avoid logging the password!
  info('Mongoose connection URL: %s', mongoUrl.replace(/\/\/(.*):(.*)@/, '//$1:<password>@'));

  if (mongoose.Promise !== global.Promise) {
    // Mongoose 5.x should use ES6 Promises by default!
    throw new Error('Mongoose is not using native ES6 Promises!');
  }

  status.setComponentError('MongoDB', 'Never Connected');
  info('Mongoose connection: Never Connected');

  // NOTE: Registering a listener for the 'error' event
  // suppresses error reporting from the connect() method.
  // Therefore call connect() BEFORE registering listeners!
  await mongoose.connect(mongoUrl, cfg.mongo.options);

  status.setComponentOk('MongoDB', 'Connected');
  info('Mongoose connection: Connected');

  mongoose.connection.on('connected', () => {
    status.setComponentOk('MongoDB', 'Connected');
    info('Mongoose connection: Connected');
  });

  mongoose.connection.on('disconnected', () => {
    status.setComponentError('MongoDB', 'Disconnected');
    warn('Mongoose connection: Disconnected');
  });

  mongoose.connection.on('timeout', () => {
    status.setComponentError('MongoDB', 'Timeout');
    info('Mongoose connection: Timeout');
  });

  mongoose.connection.on('reconnect', () => {
    status.setComponentOk('MongoDB', 'Reconnected');
    info('Mongoose connection: Reconnected');
  });

  mongoose.connection.on('close', () => {
    status.setComponentError('MongoDB', 'Closed');
    warn('Mongoose connection: Closed');
  });

  mongoose.connection.on('reconnectFailed', () => {
    status.setComponentError('MongoDB', 'Reconnect Failed (Restart Required)');
    error('Mongoose connection: Reconnect Failed');
    // Mongoose has stopped attempting to reconnect,
    // so initiate appliction shutdown with the
    // expectation that systemd will auto restart.
    error('Sending Shutdown signal: SIGINT');
    process.kill(process.pid, 'SIGINT');
  });

  mongoose.connection.on('error', (err) => {
    status.setComponentError('MongoDB', '%s', err);
    error('Mongoose connection error: %s', err);
  });

  // Database Migration
  info('Migrate database schema to latest version');
  await migrations.migrate();

  // Authentication configuration
  if (!Array.isArray(cfg.app.admin_roles)) {
    throw new Error('Administrator roles must be an array');
  }
  const adminRoles = cfg.app.admin_roles.map(String);
  info('Administrator roles: [%s]', adminRoles);

  {
    if (!cfg.ldap.url) {
      throw new Error('LDAP URL must be specified');
    }

    if (!cfg.ldap.bindDN) {
      throw new Error('LDAP bindDN must be specified');
    }

    if (!cfg.ldap.password) {
      throw new Error('LDAP password must be specified');
    }

    const ldapOptions = {
      url: String(cfg.ldap.url).trim(),
      bindDN: String(cfg.ldap.bindDN).trim(),
      bindCredentials: String(cfg.ldap.password),
      tlsOptions: cfg.ldap.tlsOptions,
      strictDN: cfg.ldap.strictDN !== undefined ? Boolean(cfg.ldap.strictDN) : undefined,
      timeout: cfg.ldap.timeout ? Number(cfg.ldap.timeout) : undefined,
      idleTimeout: cfg.ldap.idleTimeout ? Number(cfg.ldap.idleTimeout) : undefined,
      connectTimeout: cfg.ldap.connectTimeout ? Number(cfg.ldap.connectTimeout) : undefined,
      reconnect: cfg.ldap.reconnect !== undefined ? Boolean(cfg.ldap.reconnect) : undefined,
    };

    ldapSearchClient = await ldapjs.Client.create(ldapOptions);
    info('LDAP search client connected: %s', cfg.ldap.url);
    status.setComponentOk('LDAP Search', 'Connected');

    ldapSearchClient.on('connect', () => {
      info('LDAP search client reconnected: %s', cfg.ldap.url);
      status.setComponentOk('LDAP Search', 'Reconnected');
    });

    ldapSearchClient.on('idle', () => {
      info('LDAP search client connection is idle');
    });

    ldapSearchClient.on('close', () => {
      warn('LDAP search client connection is closed');
    });

    ldapSearchClient.on('error', (err) => {
      error('LDAP search client connection: %s', err);
    });

    ldapSearchClient.on('quietError', (err) => {
      status.setComponentError('LDAP Search', '%s', err);
    });

    if (!cfg.forgapi.userSearch || !cfg.forgapi.userSearch.base || !cfg.forgapi.userSearch.filter) {
      throw new Error('LDAP user search options \'base\' and \'filter\' are required');
    }

    if (!cfg.forgapi.groupSearch || !cfg.forgapi.groupSearch.base || !cfg.forgapi.groupSearch.filter) {
      throw new Error('LDAP group search options \'base\' and \'filter\' are required');
    }

    const forgClient = new forgapi.Client(ldapSearchClient, {
      userSearch: {
        base: String(cfg.forgapi.userSearch.base),
        filter: String(cfg.forgapi.userSearch.filter),
      },
      groupSearch: {
        base: String(cfg.forgapi.groupSearch.base),
        filter: String(cfg.forgapi.groupSearch.filter),
      },
      userAttributes: cfg.forgapi.userAttributes,
      groupAttributes: cfg.forgapi.groupAttributes,
    });

    if (env === 'production' || process.env.WEBAPP_AUTHC_DISABLED !== 'true') {
      ldapBindClient = await ldapjs.Client.create(ldapOptions);
      info('LDAP bind client connected: %s', cfg.ldap.url);
      status.setComponentOk('LDAP Bind', 'Connected');

      ldapBindClient.on('connect', () => {
        info('LDAP bind client reconnected: %s', cfg.ldap.url);
        status.setComponentOk('LDAP Bind', 'Reconnected');
      });

      ldapBindClient.on('idle', () => {
        info('LDAP bind client connection is idle');
      });

      ldapBindClient.on('close', () => {
        warn('LDAP bind client connection is closed');
      });

      ldapBindClient.on('error', (err) => {
        error('LDAP bind client connection: %s', err);
      });

      ldapBindClient.on('quietError', (err) => {
        status.setComponentError('LDAP Bind', '%s', err);
      });

      auth.setProvider(new ldapauth.LDAPFormForgPassportProvider(forgClient, ldapBindClient, {}));
      info('LDAP authentication provider enabled');
    } else {
      // Use this provider for local development that DISABLES authentication!
      auth.setProvider(new ldapauth.DevFormForgPassportProvider(forgClient, {}));
      warn('Development authentication provider: Password verification DISABLED!');
    }
  }

  // view engine configuration
  app.set('views', path.resolve(__dirname, '..', 'views'));
  app.set('view engine', 'pug');
  app.set('view cache', (env === 'production') ? true : false);

  // Session configuration
  app.use(session({
    store: new session.MemoryStore(),
    resave: false,
    saveUninitialized: false,
    secret: String(cfg.app.session_secret),
    cookie: {
      maxAge: Number(cfg.app.session_life),
    },
  }));

  // Authentication handlers (must follow session middleware)
  app.use(auth.getProvider().initialize());

  // Request logging configuration (must follow authc middleware)
  morgan.token('remote-user', (req) => {
    const username = auth.getUsername(req);
    return username || 'anonymous';
  });

  if (env === 'production') {
    app.use(morgan('short'));
  } else {
    app.use(morgan('dev'));
  }

  // favicon configuration
  app.use(favicon(path.resolve(__dirname, '..', 'public', 'favicon.ico')));

  // static file configuration
  app.use(express.static(path.resolve(__dirname, '..', 'public')));

  // Redirect requests ending in '/' and set response locals 'basePath'
  app.use(handlers.basePathHandler());

  // body-parser configuration
  app.use(bodyparser.json());
  app.use(bodyparser.urlencoded({
    extended: false,
  }));

  const authroute = express.Router();

  // Authenticate Success Handler
  authroute.use((req, res, next) => {
    const username = auth.getUsername(req);
    if (!username) {
      next();
      return;
    }
    info(`Authentication completed: username: '%s'`, username);
    if (req.query.bounce) {
      res.redirect(req.query.bounce);
      return;
    }
    res.redirect(res.locals.basePath || '/');
  });

  authroute.use(auth.getProvider().authenticate({
    failureMessage: true,
    failWithError: true,
  }));

  // Authenticate Success Handler
  authroute.use((req, res, next) => {
    const provider = auth.getProvider();
    const username = provider.getUsername(req);
    if (!username) {
      next(new Error('Username is undefined after authentication!'));
      return;
    }
    const userroles = provider.getRoles(req);
    if (!userroles) {
      next(new Error('User roles are undefined after authentication!'));
      return;
    }
    info(`Authentication success: username: '%s', roles: [%s]`, username, userroles);
    if (req.query.bounce) {
      res.redirect(req.query.bounce);
      return;
    }
    res.redirect(res.locals.basePath || '/');
  });

  app.get('/login', authroute, (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.name !== 'AuthenticationError') {
      next(err);
      return;
    }
    // Authentication error expected for 'GET' requests.
    res.status(handlers.HttpStatus.OK).render('login');
  });

  app.post('/login', authroute, (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.name !== 'AuthenticationError') {
      next(err);
      return;
    }
    let reason = err.message;
    if (req.session && req.session.messages) {
      reason = String(req.session.messages);
      req.session.messages = []; // clear
    }
    const username = req.body.username || '';
    warn(`Authentication failure: username: '%s', reason(s): '%s'`, username, reason);
    res.render('login', { username, message: 'Username or password is incorrect' });
  });

  app.get('/logout', (req, res) => {
    auth.getProvider().logout(req);
    const provider = auth.getProvider();
    if (provider instanceof forgauth.ForgCasProvider) {
      const redirectUrl = provider.getCasLogoutUrl(true);
      info('Redirect to CAS logout: %s', redirectUrl);
      res.redirect(redirectUrl);
      return;
    }
    res.redirect(res.locals.basePath || '/');
  });

  app.get('/', (req, res) => {
    res.render('index');
  });

  app.use('/status', status.router);
  app.use(devices.getRouter({ adminRoles }));
  app.use(slots.getRouter({ adminRoles }));
  app.use(groups.getRouter({ adminRoles }));
  app.use(checklists.getRouter({ adminRoles }));
  app.use(views.getRouter());
  app.use(api1.getRouter());
  app.use(api2.getRouter());

  // no handler found for request (404)
  app.use(handlers.notFoundHandler());

  // error handlers
  app.use(handlers.requestErrorHandler());

  info('Application started');
  return app;
}

// asynchronously stop the application
export function stop(): Promise<void> {
  return task.stop();
}

// asynchronously disconnect the application
async function doStop(): Promise<void> {
  info('Application stopping');

  if (activeResponses.size > 0) {
    info('Wait for %s active response(s)', activeResponses.size);
    try {
      await Promise.race([activeFinished, promises.rejectTimeout(15000)]);
    } catch (err) {
      warn('Timeout: End %s active response(s)', activeResponses.size);
      for (const res of activeResponses) {
        res.end();
      }
    }
  }

  if (activeSockets.size > 0) {
    warn('Destroy %s active socket(s)', activeSockets.size);
    for (const soc of activeSockets) {
      soc.destroy();
    }
  }

  if (ldapBindClient) {
    try {
      await ldapBindClient.unbind();
      ldapBindClient.destroy();
      info('LDAP bind client connection destroyed');
    } catch (err) {
      warn('LDAP bind client connection unbind failure: %s', err);
    }
  }

  if (ldapSearchClient) {
    try {
      await ldapSearchClient.unbind();
      ldapSearchClient.destroy();
      info('LDAP search client connection destroyed');
    } catch (err) {
      warn('LDAP search client connection unbind failure: %s', err);
    }
  }

  // disconnect Mongoose (MongoDB)
  try {
    await mongoose.disconnect();
    info('Mongoose disconnected');
  } catch (err) {
    warn('Mongoose disconnect failure: %s', err);
  }

  try {
    await status.monitor.stop();
    info('Status monitor stopped');
  } catch (err) {
    warn('Status monitor stop failure: %s', err);
  }

  info('Application stopped');
}

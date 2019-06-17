/**
 * Start and stop the test application.
 */
import * as path from 'path';

import * as bodyparser from 'body-parser';
import * as express from 'express';
import * as session from 'express-session';
import * as mongoose from 'mongoose';

import { State } from '../app';

import * as auth from '../app/shared/auth';
import * as forgauth from '../app/shared/forg-auth';
import * as handlers from '../app/shared/handlers';
import * as logging from '../app/shared/logging';
import * as status from '../app/shared/status';
import * as tasks from '../app/shared/tasks';

import * as api1 from '../app/routes/api1';
import * as api2 from '../app/routes/api2';
import * as checklists from '../app/routes/checklists';
import * as devices from '../app/routes/devices';
import * as groups from '../app/routes/groups';
import * as slots from '../app/routes/slots';

import * as mongod from './shared/mongod';

import * as forgapi from './shared/mock-forgapi';

// application states
export type State = State;

// application singleton
let app: express.Application;

// application lifecycle
const task = new tasks.StandardTask<express.Application>(doStart, doStop);

// application logging
export let info = logging.log;
export let warn = logging.warn;
export let error = logging.error;

export function getState(): State {
  return task.getState();
}

// start the test application
export function start(): Promise<express.Application> {
  return task.start();
}

async function doStart(): Promise<express.Application> {
  app = express();

  if (app.get('env') === 'test') {
    // disable logging for testing
    logging.setInfo(null);
    logging.setWarn(null);
    logging.setError(null);
  }

  const forgClient = forgapi.MockClient.getInstance();

  const authProvider = new forgauth.DevForgBasicProvider(forgClient, { realm: 'TEST' });

  auth.setProvider(authProvider);


  // status monitor start
  await status.monitor.start();

  // start local MongoDB server (optional)
  let mongoPort = 27017;
  if (process.env.WEBAPP_START_MONGOD === 'true') {
    mongoPort = await mongod.start();
  }

  // configure Mongoose (MongoDB)
  const mongoUrl = `mongodb://localhost:${mongoPort}/webapp-test`;

  const mongoOptions: mongoose.ConnectionOptions = {
    // remove deprecation warnings
    useFindAndModify: false,
    useNewUrlParser: true,
    useCreateIndex: true,
  };

  await mongoose.connect(mongoUrl, mongoOptions);
  // Clear the DB on application startup?
  // await mongoose.connection.db.dropDatabase();

  app.use(bodyparser.json());
  app.use(bodyparser.urlencoded({
    extended: false,
  }));

  // session configuration
  app.use(session({
    store: new session.MemoryStore(),
    resave: false,
    saveUninitialized: false,
    secret: 'test_secret',
    cookie: {
      maxAge: 28800000,
    },
  }));

  app.use(express.static(path.resolve(__dirname, '..', '..', 'public')));

  app.use(authProvider.initialize());

  app.get('/login', authProvider.authenticate(), (req, res) => {
    if (req.query.bounce) {
      res.redirect(req.query.bounce);
      return;
    }
    res.redirect('/');
  });

  app.get('/logout', (req, res) => {
    authProvider.logout(req);
    res.redirect('/');
  });

  app.use('/status', status.router);
  app.use(devices.getRouter());
  app.use(slots.getRouter());
  app.use(groups.getRouter());
  app.use(checklists.getRouter());
  app.use(api1.getRouter());
  app.use(api2.getRouter());

  // no handler found for request
  app.use(handlers.notFoundHandler());

  // error handlers
  app.use(handlers.requestErrorHandler());

  return app;
}

// stop the test application
export function stop(): Promise<void> {
  return task.stop();
}

async function doStop(): Promise<void> {

  // disconnect Mongoose (MongoDB)
  try {
    await mongoose.disconnect();
  } catch (err) {
    warn('Mongoose disconnect failure: %s', err);
  }

  if (process.env.WEBAPP_START_MONGOD === 'true') {
    try {
      await mongod.stop();
    } catch (err) {
      warn('MongoDB stop failure: %s', err);
    }
  }

  try {
    await status.monitor.stop();
  } catch (err) {
    warn('Status monitor stop failure: %s', err);
  }

  return;
}

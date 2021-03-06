/**
 * Import data from a file to the database.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as dbg from 'debug';
import mongoose = require('mongoose');
import rc = require('rc');

import * as history from '../app/shared/history';

import { Slot } from '../app/models/slot';

import { Device } from '../app/models/device';

import {
  Checklist,
  ChecklistSubject,
} from '../app/models/checklist';


interface HistoryDocument extends history.Document<HistoryDocument> {}

interface Config {
  configs?: string[];
  h?: {};
  help?: {};
  mongo: {
    user?: {};
    pass?: {};
    port: {};
    addr: {};
    db: {};
    options: {};
  };
  user?: {};
  dryrun?: {};
  _?: Array<{}>;
}

mongoose.Promise = global.Promise;

const debug = dbg('import-file');

const info = console.info;
const error = console.error;

async function main() {

  const cfg: Config = {
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'runcheck-dev',
      options: {
        // see http://mongoosejs.com/docs/connections.html
        useMongoClient: true,
      },
    },
  };

  rc('import-file', cfg);
  if (cfg.configs) {
    for (const file of cfg.configs) {
      info('Load configuration: %s', file);
    }
  }

  if (debug.enabled) {
    debug(JSON.stringify(cfg, null, 4));
  }

  if (cfg.h || cfg.help) {
    info(`Usage: import-file [ options ] data.json [ ... ]

    Options
        --help               display help information
        --config [rcfile]    load configuration from rcfile
        --user [username]    username to use when saving with history
        --dryrun [dryrun]    validate CCDB data (default: true)
    `);
    return;
  }

  if (!cfg._ || (cfg._.length === 0)) {
    info('Data file(s) must be specified');
    return;
  }

  const models = new Map<string, mongoose.Model<mongoose.Document>>();

  for (const filePath of cfg._) {
    const absFilePath = path.resolve(String(filePath));
    const name = path.basename(absFilePath, '.json');
    if (name.toUpperCase() === Slot.collection.name.toUpperCase()) {
      models.set(absFilePath, Slot);
    } else if (name.toUpperCase() === Device.collection.name.toUpperCase()) {
      models.set(absFilePath, Device);
    } else if (name.toUpperCase() === Checklist.collection.name.toUpperCase()) {
      models.set(absFilePath, Checklist);
    } else if (name.toUpperCase() === ChecklistSubject.collection.name.toUpperCase  ()) {
      models.set(absFilePath, ChecklistSubject);
    } else {
      info('No model associated with data file: %s', filePath);
      return;
    }
  }

  let valid = true;

  const documents = new Map<string, mongoose.Document[]>();

  for (const [filePath, Model] of models.entries()) {
    let docs = documents.get(filePath);
    if (!docs) {
      documents.set(filePath, docs = []);
    }

    const data = await new Promise<Array<{}>>((resolve, reject) => {
      debug('Read and parse file: %s', filePath);
      fs.readFile(filePath, 'UTF-8', (err, json) => {
        if (err) {
          reject(err);
          return;
        }
        let d;
        try {
          d = JSON.parse(json);
        } catch (err) {
          reject(err);
          return;
        }
        if (!Array.isArray(d)) {
          reject(new Error('Array of documents expected'));
          return;
        }
        resolve(d);
      });
    });
    debug('Total data records read: %s', data.length);

    for (const d of data) {
      info('Create %s and validate: %s', Model.modelName, JSON.stringify(d));
      const doc = new Model(d);
      try {
        await doc.validate();
      } catch (err) {
        valid = false;
        error(err);
      }
      docs.push(doc);
    }
  }

  if (!valid) {
    return;
  }

  if (cfg.dryrun !== false && cfg.dryrun !== 'false') {
    info('DRYRUN DONE');
    return;
  }

  // Configure Mongoose (MongoDB)
  let mongoUrl = 'mongodb://';
  if (cfg.mongo.user) {
    mongoUrl += encodeURIComponent(String(cfg.mongo.user));
    if (cfg.mongo.pass) {
      mongoUrl += ':' + encodeURIComponent(String(cfg.mongo.pass));
    }
    mongoUrl += '@';
  }
  mongoUrl += cfg.mongo.addr + ':' + cfg.mongo.port + '/' + cfg.mongo.db;

  await mongoose.connect(mongoUrl, cfg.mongo.options);

  const updatedBy = cfg.user ? String(cfg.user) : 'system';

  for (const [, docs] of documents.entries()) {
    for (const doc of docs) {
      try {
        if (typeof (doc as HistoryDocument).saveWithHistory === 'function') {
          await (doc as HistoryDocument).saveWithHistory(updatedBy);
        } else {
          await doc.save();
        }
      } catch (err) {
        error(err);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(error);

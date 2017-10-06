/**
 * Import data from a file to the database.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as dbg from 'debug';
import rc = require('rc');
import mongoose = require('mongoose');

import * as history from '../app/shared/history';

import {
  Checklist,
  ChecklistSubject,
} from '../app/models/checklist';

//import slot = require('../app/models/slot');
//import device = require('../app/models/device');


interface HistoryDocument extends history.Document<HistoryDocument> {};

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
};

mongoose.Promise = global.Promise;

const debug = dbg('import-ccdb');

const info = console.info;
const warn = console.warn;
const error = console.error;

async function main() {

  let cfg: Config = {
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
    for (let file of cfg.configs) {
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

  let models = new Map<string, mongoose.Model<mongoose.Document>>();

  for (let filePath of cfg._) {
    let absFilePath = path.resolve(String(filePath));
    let name = path.basename(absFilePath, '.json');
    if (name.toLowerCase() === Checklist.collection.name.toLowerCase()) {
      models.set(absFilePath, Checklist);
      continue;
    } else if (name.toLowerCase() === ChecklistSubject.collection.name.toLowerCase()) {
      models.set(absFilePath, ChecklistSubject);
      continue;
    } else {
      info('No model associated with data file: %s', filePath);
      return;
    }
  }

  let valid = true;

  let documents = new Map<string, mongoose.Document[]>();

  for (let [filePath, Model] of models.entries()) {
    let docs = documents.get(filePath);
    if (!docs) {
      documents.set(filePath, docs = []);
    }

    let data = await new Promise<Array<{}>>((resolve, reject) => {
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

    for (let d of data) {
      debug('Create document and validate: %s', JSON.stringify(d));
      let doc = new Model(d);
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

  for (let [filePath, docs] of documents.entries()) {
    for (let doc of docs) {
      if (typeof (<HistoryDocument> doc).saveWithHistory === 'function') {
        await (<HistoryDocument> doc).saveWithHistory(updatedBy);
      } else {
        await doc.save();
      }
    }
  }

  await mongoose.disconnect();
};

main().catch(error);

/**
 * Modify RunCheck data using a CSV data file.
 */
import * as fs from 'fs';
import * as util from 'util';

import * as csvparse from 'csv-parse';
import * as dbg from 'debug';
import * as mongoose from 'mongoose';
import rc = require('rc');

import * as auth from '../app/shared/auth';
import * as history from '../app/shared/history';

import {
  Slot,
} from '../app/models/slot';

import {
  Device,
} from '../app/models/device';

// Plain Old Javascript Object
interface POJO {
  [key: string]: {} | undefined;
}

// Need to use interface because of recurrsive type definition!
interface HistoryDocument extends history.Document<HistoryDocument> {}

type HistoryModel = history.Model<HistoryDocument>;

interface Config {
  configs?: string[];
  h?: {};
  help?: {};
  mongo: {
    user?: {};
    pass?: {};
    host?: {};
    port: {};
    addr: {};
    db: {};
    options: {};
  };
  dryrun?: {};
  updateBy?: {};
  _?: Array<{}>;
}


const debug = dbg('update-csv');

const readFile = util.promisify(fs.readFile);

const info = console.info;
const warn = console.warn;
const error = console.error;

const USR = auth.RoleScheme.USR;


/**
 * Split is similar to the standard function except
 * it returns an empty array for an empty string.
 */
function split(str: string, pattern: RegExp) {
  if (str.length === 0) {
    return [];
  }
  return str.split(pattern);
}

async function main() {

  const cfg: Config = {
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'runcheck-dev',
      options: {
        // Use the "new" URL parser (Remove deprecation warning in Mongoose 5.x!)
        useNewUrlParser: true,
      },
    },
  };

  rc('update-cvs', cfg);
  if (cfg.configs) {
    for (const file of cfg.configs) {
      info('Load configuration: %s', file);
    }
  }

  if (debug.enabled) {
    debug(JSON.stringify(cfg, null, 4));
  }

  if (cfg.h || cfg.help) {
    info(`Usage: update-csv [ options ] [ slot | device ] data.csv

    Options
      -h, --help             display help information
      --config [rcfile]      load configuration from rcfile
      --dryrun [dryrun]      validate input data (default: true)
      --updateBy [username]  username to use for saving history
    `);
    return;
  }

  if (!Array.isArray(cfg._) || (cfg._.length === 0)) {
    error('Error: no model type specified');
    process.exitCode = 1;
    return;
  }

  let Model: HistoryModel;
  switch (String(cfg._[0]).toUpperCase()) {
  case 'SLOT':
    Model = Slot;
    break;
  case 'DEVICE':
    Model = Device;
    break;
  default:
    error('Error: specified model not supported: %s', cfg._[0]);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(cfg._) || (cfg._.length === 1)) {
    error('Error: no data file specified');
    process.exitCode = 1;
    return;
  }

  if (cfg._.length > 2) {
    error('Error: Only one data file can be specified');
    process.exitCode = 1;
    return;
  }

  const updateBy = cfg.updateBy ? String(cfg.updateBy).trim().toUpperCase() : '';
  if (!updateBy) {
    error(`Error: Parameter 'updateBy' is required`);
    process.exitCode = 1;
    return;
  }

  const buffer = await readFile(String(cfg._[1]), 'UTF-8');

  const data = await new Promise<POJO[]>((resolve, reject) => {
    csvparse(buffer, { trim: true, columns: true, comment: '#' }, (err, output) => {
      if (err) {
        reject(err);
        return;
      }
      if (!Array.isArray(output)) {
        reject(new Error('CSV parse output is not a array'));
        return;
      }
      resolve(output);
    });
  });

  // Configure Mongoose (MongoDB)
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

  await mongoose.connect(mongoUrl, cfg.mongo.options);

  try {
    let hasError = false;
    const modified = new Array<HistoryDocument>();
    outer: for (const record of data) {
      let cond: POJO | undefined;
      for (let prop in record) {
        if (record.hasOwnProperty(prop) && prop.startsWith('cond:')) {
          // Record value should already be a string, but this will ensure it!
          const recValue = String(record[prop]);
          // Remove the 'cond:' prefix from the property
          prop = prop.substring(5);

          const path = Model.schema.path(prop);
          if (!path) {
            error('Error: Document (%s) schema does not have path: %s', Model.modelName, prop);
            hasError = true;
            continue outer;
          }

          if (!cond) {
            cond = {};
          }

          // If path is type array then convert comma seperated list to array
          if (path instanceof mongoose.Schema.Types.Array) {
            const splitRecValue = split(recValue, /\s*,\s*/);
            debug('Condition property: %s, value split into array: "%s" => [%s]', prop, recValue, splitRecValue);
            cond[prop] = splitRecValue;
            continue;
          }

          debug('Condition property: %s, with value: %s', prop, recValue);
          cond[prop] = recValue;
        }
      }
      if (!cond) {
        error('Error: No conditions specified to find document');
        hasError = true;
        continue;
      }

      const docs = await Model.find(cond).exec();
      if (docs.length === 0) {
        error('Error: No document found with conditions: %s', JSON.stringify(cond));
        hasError = true;
        continue;
      }
      if (docs.length > 1) {
        error('Error: Mutliple documents found with conditions: %s', JSON.stringify(cond));
        hasError = true;
        continue;
      }

      const doc = docs[0];

      for (const prop in record) {
        if (record.hasOwnProperty(prop) && !prop.startsWith('cond:')) {
          // Record value should already be a string, but this will ensure it!
          const recValue = String(record[prop]);

          const path = doc.schema.path(prop);
          if (!path) {
            error('Error: Document (%s) schema does not have path: %s', Model.modelName, prop);
            hasError = true;
            continue outer;
          }

          // If path is type array then convert comma seperated list to array
          if (path instanceof mongoose.Schema.Types.Array) {
            const splitRecValue = split(recValue, /\s*,\s*/);
            debug('Record property: %s, value split into array: "%s" => [%s]', prop, recValue, splitRecValue);

            const docValue = doc.get(prop);
            if (!Array.isArray(docValue)) {
              warn('Warning: Document property: %s, array value expected', prop);
              doc.set(prop, splitRecValue);
            } else if (splitRecValue.join() !== docValue.join()) {
              doc.set(prop, splitRecValue);
            }
            continue;
          }

          debug('Record property: %s, with value: %s', prop, recValue);
          doc.set(prop, recValue);
        }
      }

      const modifiedPaths: string[] = [];
      for (const path of doc.modifiedPaths()) {
        // Ignore changes to the 'history' subdocument,
        // not sure exactly why these are marked as modified!
        if (path !== 'history' && !path.startsWith('history.')) {
          modifiedPaths.push(path);
        }
      }

      if (modifiedPaths.length === 0) {
        warn('Warning: Document (%s: %s): not modified', Model.modelName, JSON.stringify(cond));
        continue;
      }

      info('Document (%s: %s): modified {', Model.modelName, JSON.stringify(cond));
      info('  "_id":"%s"', doc._id);
      for (const path of modifiedPaths) {
        info('  "%s":%s', path, JSON.stringify(doc.get(path)));
      }
      info('}');

      try {
        await doc.validate();
      } catch (err) {
        error(err.message);
        hasError = true;
        continue;
      }

      modified.push(doc);
    }

    if (hasError) {
      process.exitCode = 1;
      return;
    }

    if (cfg.dryrun !== false && cfg.dryrun !== 'false') {
      info('DRYRUN DONE');
      process.exitCode = 1;
      return;
    }

    for (const doc of modified) {
      try {
        info('Saving document with history: %s', doc.id);
        await doc.saveWithHistory(auth.formatRole(USR, updateBy));
      } catch (err) {
        error(err.message);
        process.exitCode = 1;
        continue;
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) =>  {
  // ensure non-zero exit code
  if (process.exitCode === 0) {
    process.exitCode = 1;
  }
  error(`Error: ${err}`);
});

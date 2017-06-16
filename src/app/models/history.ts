/**
 * Data model to record arbitrary changes to a document.
 *
 * A plugin is provided to easily provide update histroy to any document.
 *
 */
import mongoose = require('mongoose');
import debugging = require('debug');

import log = require('../lib/log');
import models = require('../shared/models');


type ObjectId = mongoose.Types.ObjectId;

export interface Change {
  p: string;
  v: any;
};

export interface History extends mongoose.Document {
  a: Date;
  b: string;
  t: string;
  i: ObjectId;
  c: [Change];
};

export interface DocumentWithHistory<T extends DocumentWithHistory<T>> extends mongoose.Document {
  __updates: ObjectId[] | History[];
  saveWithHistory(userid: string | { userid: string }, cb?: (err: any, prod?: T) => void): Promise<T>;
}

export interface HistoryOptions {
  watchAll?: boolean;
  fieldsToWatch?: string[];
};

const debug = debugging('runcheck:history');

const Schema = mongoose.Schema;
const Mixed = Schema.Types.Mixed;
const ObjectId = Schema.Types.ObjectId;

/**********
 * p: the property of an object
 * v: the change-to value of the property
 **********/
const ChangeSchema = new Schema({
  p: {
    type: String,
    required: true,
  },
  v: {
    type: Mixed,
  },
});


/**********
 * a: at, the date of the history
 * b: by, the author of the history
 * t: type, the object's type
 * i: id, the object's id
 * c: the array of changes
 **********/
const HistorySchema = new Schema({
  a: {
    type: Date,
    required: true,
    default: Date.now(),
  },
  b: {
    type: String,
    required: true,
  },
  t: {
    type: String,
    required: true,
  },
  i: {
    type: ObjectId,
    refPath: 't',
    required: true,
  },
  c: [ChangeSchema],
});

export const History = mongoose.model<History>('History', HistorySchema);

/**
 * add History plugin
 * @param {Schema} schema
 * @param {Object} options
 */
export function addHistory<T extends DocumentWithHistory<T>>(schema: mongoose.Schema, options?: HistoryOptions) {
  let fieldsToWatch = <string[]> [];

  if (!options || options.watchAll === true) {
    schema.eachPath((path, type) => {
      if (['_id', '__updates'].indexOf(path) === -1) {
        fieldsToWatch.push(path);
      }
    });
  } else if (Array.isArray(options.fieldsToWatch)) {
    options.fieldsToWatch.forEach((path) => {
      if ((['_id', '__updates'].indexOf(path) === -1) && schema.path(path) && (fieldsToWatch.indexOf(path) === -1)) {
        fieldsToWatch.push(path);
      }
    });
  }

  schema.add({
    __updates: [{
      type: ObjectId,
      ref: History.modelName,
    }],
  });

  /**
   * model instance method to save with history. A document should use #set()
   * to update in order to get the modified check working properly for
   * embedded document. Otherwise, explicitly #markModified(path) to mark
   * modified of the path.
   * @param  {String}   userid the user making this update
   * @param  {Function} cb     the callback when save is done
   */
  schema.methods.saveWithHistory = function (userid: string | { userid: string },
                                             cb?: (err: any, prod?: T) => void): Promise<T> {
    let doc = <T> this;

    let p = new Promise<T>((resolve, reject) => {

      let uid: string;
      if ((<{ userid: string}> userid).userid) {
        uid = (<{ userid: string}> userid).userid;
      } else {
        uid = <string> userid;
      }

      if (!doc.isModified()) {
        resolve(doc.save(cb));
        return;
      }

      let c = <Change[]> [];
      debug(fieldsToWatch);
      fieldsToWatch.forEach(function (field) {
        debug(field + ' is modified ' + doc.isModified(field));
        if ((doc.isNew && doc.get(field)) || doc.isModified(field)) {
          c.push({
            p: field,
            v: doc.get(field),
          });
        }
      });

      if (c.length === 0) {
        resolve(doc.save(cb));
        return;
      }

      debug('Model name: ' + (<mongoose.Model<T>> doc.constructor).modelName);
      debug('Model name: ' + doc.schema);
      debug('Model name: ' + doc.modelName);
      debug('Model name: ' + doc.baseModelName);


      debug('History name: ' + History.modelName);

      let h = new History(<History> {
        a: new Date(),
        b: uid,
        c: c,
        t: models.getModelName(doc),
        i: doc._id,
      });

      debug(h);
      h.save().then(
        (historyDoc: History) => {
          if (historyDoc) {
            (<ObjectId[]> doc.__updates).push(historyDoc._id);
          }
          resolve(doc.save(cb));
        },
        (err) =>  {
          if (typeof(cb) === 'function') {
            cb(err);
          }
          reject(err);
        },
      );
    });

    return p;
  };

  /**
   * Save a history first before save the doc. This can be helpful when
   * you want to save the history manually, e.g. some changes not in the
   * change watch list, or use update() to update the document.
   * manually.
   * @param  {String}     userid the user making this update
   * @param  {[change]}   c      the change array
   * @param  {Function}   cb     the callback when the history is saved
   */
  schema.methods.saveHistory = function (userid: string | { userid: string }, c: Change[],
                                         cb?: (err?: any, id?: ObjectId ) => void): Promise<ObjectId> {
    let doc = <mongoose.Document> this;

    let p = new Promise<ObjectId>(function (resolve, reject) {
      let uid: string;
      if ((<{ userid: string }> userid).userid) {
        uid = (<{ userid: string }> userid).userid;
      } else {
        uid = <string> userid;
      }

      if (c.length === 0) {
        if (typeof cb === 'function') {
          cb();
        }
        resolve();
      }

      debug('Model name: ' + doc.modelName);

      let h = new History(<History> {
        a: new Date(),
        b: uid,
        c: c,
        t: models.getModelName(doc),
        i: doc._id,
      });

      debug(h);

      h.save(function (err, historyDoc) {
        if (err) {
          if (typeof cb === 'function') {
            cb(err);
          }
          return;
        }
        if (typeof cb === 'function') {
          cb(null, historyDoc._id);
        }
        resolve(historyDoc._id);
      });
    });

    return p;
  };
}

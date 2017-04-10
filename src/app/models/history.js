var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;
var assert = require('assert');

var debug = require('debug')('runcheck:history');
var log = require('../lib/log');
var _ = require('lodash');

/**********
 * p: the property of an object
 * v: the change-to value of the property
 **********/
var change = new Schema({
  p: {
    type: String,
    required: true
  },
  v: {
    type: Mixed
  }
});


/**********
 * a: at, the date of the history
 * b: by, the author of the history
 * t: type, the object's type
 * i: id, the object's id
 * c: the array of changes
 **********/
var history = new Schema({
  a: {
    type: Date,
    required: true,
    default: Date.now()
  },
  b: {
    type: String,
    required: true
  },
  t: {
    type: String,
    required: true
  },
  i: {
    type: ObjectId,
    refPath: 't',
    required: true
  },
  c: [change]
});

var History = mongoose.model('History', history);

/**
 * handle the error
 * @param  {Error}   err
 * @param  {Function} cb
 */
function handleErr(err, cb) {
  if (cb && _.isFunction(cb)) {
    return cb(err);
  } else {
    log.error(err);
  }
}

/**
 * add History plugin
 * @param {Schema} schema
 * @param {Object} options
 */
function addHistory(schema, options) {
  options = options || {};
  if (options.watchAll === true) {
    options.fieldsToWatch = Object.keys(schema.paths);
  }
  options.fieldsToWatch = _
    .chain()
    .concat(options.fieldsToWatch)
    .reject(function (field) {
      return !schema.path(field) || _.includes(['__updates', '_id'], field);
    })
    .value();

  schema.add({
    __updates: [{
      type: ObjectId,
      ref: History.modelName
    }]
  });

  /**
   * model instance method to save with history. A document should use #set()
   * to update in order to get the modified check working properly for
   * embedded document. Otherwise, explicitly #markModified(path) to mark
   * modified of the path.
   * @param  {String}   userid the user making this update
   * @param  {Function} cb     the callback when save is done
   */
  schema.methods.saveWithHistory = function (userid, cb) {
    var doc = this;
    var p = new Promise(function (resolve, reject) {
      var uid
      var c = [];
      var h;

      if (!_.isNil(userid)) {
        if (_.isString(userid)) {
          uid = userid;
        } else {
          if (_.isString(userid.userid)) {
            uid = userid.userid;
          }
        }
      }

      assert.ok(uid, 'must specify user id');

      if (doc.isModified()) {
        debug(options.fieldsToWatch);
        options.fieldsToWatch.forEach(function (field) {
          debug(field + ' is modified ' + doc.isModified(field));
          if ((doc.isNew && doc.get(field)) || doc.isModified(field)) {
            c.push({
              p: field,
              v: doc.get(field)
            });
          }
        });
        debug(c);
        if (c.length > 0) {
          h = new History({
            a: Date.now(),
            b: uid,
            c: c,
            t: doc.constructor.modelName,
            i: doc._id
          });
          debug(h);
          resolve(h.save());
          return
        }
      }
      resolve();
    })
  
    .then(function (historyDoc) {
      if (historyDoc) {
        doc.__updates.push(historyDoc._id);
      }
      return doc.save();
    })
    
    .then(function (newDoc) {
      if (_.isFunction(cb)) {
        cb(null, newDoc);
      }
      return newDoc;
    })
    
    .catch(function (err) {
      if (_.isFunction(cb)) {
        return cb(err);
      } else {
        log.error(err);
        return Promise.reject(err);
      }
    });

    if (!_.isFunction(cb)) {
      return p;
    }
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
  schema.methods.saveHistory = function (userid, c, cb) {
    assert.equal(typeof userid, 'string', 'need a user id');
    assert.equal(typeof cb, 'function', 'need a callback function');
    var doc = this;
    var h;
    if (c.length > 0) {
      h = new History({
        a: Date.now(),
        b: userid,
        c: c,
        t: doc.constructor.modelName,
        i: doc._id
      });
      debug(h);
      h.save(function (err, historyDoc) {
        if (err) {
          debug(err.errors);
          return handleErr(err, cb);
        }
        cb(null, historyDoc._id);
      });
    } else {
      // no history to record, no history _id
      return cb(null, null);
    }
  };
}


module.exports = {
  History: History,
  addHistory: addHistory
};

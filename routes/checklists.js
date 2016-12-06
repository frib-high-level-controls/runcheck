var _ = require('lodash');
var express = require('express');
var checklists = express.Router();
var auth = require('../lib/auth');
var ObjectId = require('mongoose').Types.ObjectId;
var Checklist = require('../models/checklist').Checklist;
var ChecklistItem = require('../models/checklist').ChecklistItem;
var ChecklistItemCfg = require('../models/checklist').ChecklistItemCfg;
var ChecklistItemData = require('../models/checklist').ChecklistItemData;

var debug = require('debug')('runcheck:checklists');


function findChecklistById(id, lean) {
  return Checklist.findById(id).lean(lean).exec().catch(function (err) {
    console.log('warn: error retrieving Checklist (' + id + '): ' + err);
    return Promise.reject({
      error: err,
      status: 404,
      body: {
        error: {
          message: 'checklist not found'
        }
      }
    });
  })
};


function findItemsForChecklist(cl, lean) {
  var query = ChecklistItem.find({
    type: cl.type,
    checklist: { $in:[null, cl._id ] }
  });
  return query.lean(lean).exec().catch(function (err) {
    console.log('warn: Error retrieving ChecklistItems: ' + query + ': ' + err);
    return Promise.reject({
      error: err,
      status: 500,
      body: {
        error: {
          message: 'error retrieving checklist items'
        }
      }
    });
  });
};


function findItemCfgsForChecklist(cl, lean) {
  var query = ChecklistItemCfg.find({
    checklist: cl._id
  });
  return query.lean(lean).exec().catch(function (err) {
    console.log('warn: Error retrieving ChecklistItemCfgs: ' + query + ': ' + err);
    return Promise.reject({
      error: err,
      status: 500,
      body: {
        error: {
          message: 'error retrieving checklist configuration'
        }
      }
    });
  });
};


function findItemDataForChecklist(cl, lean) {
  var query = ChecklistItemData.find({
    checklist: cl._id
  });
  return query.lean(lean).exec().catch(function (err) {
    console.log('warn: Error retrieving ChecklistItemData: ' + dataQuery + ': ' + err);
    return Promise.reject({
      error: err,
      status: 500,
      body: {
        error: {
          message: 'error retrieving checklist data'
        }
      }
    });
  });
};


function respondOnError(err) {
  var status = err.status || 500;
  if (!err.body) {
    console.log('warn: Responding to unhandled error');
    console.log(err);
    return res.status(status).json({
      error: {
        message: 'unknown error'
      }
    });
  }
  return res.status(status).json(err.body);
};


checklists.get('/:id/json', auth.ensureAuthenticated, function (req, res) {
  findChecklistById(req.params['id'], true)

  .then(function (checklist) {
    var items = findItemsForChecklist(checklist, true);
    var cfgs = findItemCfgsForChecklist(checklist, true);
    var data = findItemDataForChecklist(checklist, true);
    return Promise.all([checklist, items, cfgs, data]);
  })
  
  .then(function ([checklist, items, cfgs, data]) {
    var idx, cfg, cfgMap = {};

    if (cfgs.length > 0) {
      for (idx=0; idx<cfgs.length; idx+=1) {
        cfgMap[cfgs[idx].item] = cfgs[idx];
      }

      for (idx=0; idx<items.length; idx+=1) {
        ChecklistItem.applyCfg(items[idx], cfgMap[items[idx]._id]);
      }
    }

    checklist.items = items;
    checklist.data = data;

    return res.status(200).json(checklist);
  })

  .catch(respondOnError);
});


checklists.put('/:id/items/json', auth.ensureAuthenticated, function (req, res) {
  findChecklistById(req.params['id'])

  .then(function (checklist) {
    var items = findItemsForChecklist(checklist);
    var cfgs = findItemCfgsForChecklist(checklist);
    return Promise.all([checklist, items, cfgs]);
  })
  
  .then(function ([checklist, items, cfgs]) {
    var idx,
        cfg, cfgMap = {}, cfgPms = [],
        item, itemMap = {}, itemPms = [],
        newItem, newItemMap = {}, rmItemPms = [];

    // a checklist is custom if it is associated with a checklist
    function isCustom(item) {
      return !_.isNil(item.checklist) && (item.checklist.equals(checklist._id));
    }

    for (idx=0; idx<cfgs.length; idx+=1) {
      cfgMap[cfgs[idx].item] = cfgs[idx];
    }

    for (idx=0; idx<items.length; idx+=1) {
      itemMap[items[idx]._id] = items[idx];
    }

    for (idx=0; idx<req.body.length; idx+=1) {
      newItem = req.body[idx];
      newItemMap[newItem._id] = newItem;

      if (itemMap[newItem._id]) {
        item = itemMap[newItem._id];
        cfg = cfgMap[newItem._id];
        debug('Update ChecklistItem (%s) with subject: %s', item._id, item.subject);
      } else {
        item = new ChecklistItem({
          _id: ObjectId(),
          item: item._id,
          type: checklist.type,
          checklist: checklist._id,
          subject: 'SUBJECT'
        });
        if (_.isString(newItem.subject)) {
          item.subject = newItem.subject;
        }
        debug('Add ChecklistItem (%s) with subject: %s', item._id, item.subject);
      }

      if (isCustom(item)) {
        if (_.isString(newItem.subject)) {
          if (cfg && _.isString(cfg.subject)) {
            if (cfg.subject !== newItem.subject) {
              if (item.subject !== newItem.subject) {
                cfg.subject = newItem.subject;
              } else {
                cfg.subject = null; // defer to item
              }
            }
          } else {
            if (item.subject !== newItem.subject) {
              if (!cfg) {
                cfg = new ChecklistItemCfg({
                  item: item._id,
                  type: checklist.type,
                  checklist: checklist._id
                });
              }
              cfg.subject = newItem.subject;
            }
          }
        } else {
          console.log('warn: ChecklistItem property, "subject", expecting type String');
        }
      }

      if (!item.mandatory) {
        if (_.isBoolean(newItem.required)) {
          if (cfg && _.isBoolean(cfg.required)) {
            if (cfg.required !== newItem.required) {
              if (item.required !== newItem.required) {
                cfg.required = newItem.required;
              } else {
                cfg.required = null; // defer to item
              }
            }
          } else {
            if (item.required !== newItem.required) {
              if (!cfg) {
                cfg = new ChecklistItemCfg({
                  item: item._id,
                  type: checklist.type,
                  checklist: checklist._id
                });
              }
              cfg.required = newItem.required;
            }
          }
        } else {
          console.log('warn: ChecklistItem property, "required", expecting type Boolean');
        }
      }

      if (_.isString(newItem.assignee)) {
        if (cfg && _.isString(cfg.assignee)) {
          if (cfg.assignee !== newItem.assignee) {
            if (item.assignee !== newItem.assignee) {
              cfg.assignee = newItem.assignee;
            } else {
              cfg.assignee = null; // defer to item
            }
          }
        } else {
          if (item.assignee !== newItem.assignee) {
            if (!cfg) {
              cfg = new ChecklistItemCfg({
                item: item._id,
                type: checklist.type,
                checklist: checklist._id
              });
            }
            cfg.assignee = newItem.assignee;
          }
        }
      } else {
        console.log('warn: ChecklistItem property, "assignee", expecting String');
      }

      if (item.isModified()) {
        debug('save Checklist Item: %s', item._id);
        itemPms.push(item.save().catch(function (err) {
          console.log('warn: Error saving ChecklistItem (' + item._id + '): ' + err);
          return Promise.reject({
            error: err,
            status: 500,
            body: {
              error: {
                message: 'error saving checklist item'
              }
            }
          });
        }));
      } else {
        itemPms.push(item);
      }

      if (cfg) {
        if (cfg.isModified()) {
          debug('save ChecklistItemCfg: %s', cfg._id);
          cfgPms.push(cfg.save().catch(function (err) {
            console.log('warn: Error saving ChecklistItemCfg ()' + cfg._id + '): ' + err);
            return Promise.reject({
              error: err,
              status: 500,
              body: {
                error: {
                  message: 'error saving checklist configuration'
                }
              }
            });
          }));
        } else {
          cfgPms.push(cfg);
        }
      }
    }

    for (idx=0; idx<items.length; idx+=1) {
      item = items[idx];
      if (isCustom(item) && !newItemMap[item._id]) {
        rmItemPms.push(item.remove().catch(function (err) {
          console.log('warn: Error removing ChecklistItem (' + item._id + '): ' + err);
          return Promise.reject({
            error: err,
            status: 500,
            body: {
              error: {
                message: 'error removing checklist item'
              }
            }
          });
        }));
        debug('Remove ChecklistItem: %s', item._id);
      }
    }
    return Promise.all([checklist, Promise.all(itemPms), Promise.all(cfgPms), Promise.all(rmItemPms)]);
  })

  .then(function ([checklist, items, cfgs]) {
    res.status(200).json({});
  })

  .catch(respondOnError);
});


checklists.put('/:id/inputs/json', auth.ensureAuthenticated, function (req, res) {
  findChecklistById(req.params['id'])
  
  .then(function (checklist) {
    var items = findItemsForChecklist(checklist);
    var cfgs = findItemCfgsForChecklist(checklist);
    var data = findItemDataForChecklist(checklist);
    return Promise.all([checklist, items, cfgs, data]);
  })

  .then(function ([checklist, items, cfgs, data]) {
    var idx, pms = [], 
        item, itemMap = {}, cfgMap = {},
        input, newInput, inputMap = {};

    for (idx=0; idx<cfgs.length; idx+=1) {
      cfgMap[cfgs[idx].item] = cfgs[idx];
    }

    for (idx=0; idx<items.length; idx+=1) {
      itemMap[items[idx]._id] = items[idx];
      items[idx].applyCfg(cfgMap[items[idx]._id]);
    }

    for (idx=0; idx<data.length; idx+=1) {
      if (inputMap[data[idx].item]) {
        if (inputMap[data[idx].item].inputOn < data[idx].inputOn) {
          inputMap[data[idx].item] = data[idx];
        }
      } else {
        inputMap[data[idx].item] = data[idx];
      }
    }

    for (idx=0; idx<req.body.length; idx+=1) {
      newInput = req.body[idx];
      if (_.isString(newInput._id)) {
        item = itemMap[newInput._id];
        input = inputMap[newInput._id];
        if (item && (item.mandatory || item.required)) {
          debug('Input permitted: value: %s, comment:"%s"', newInput.value, newInput.comment)
          // TODO: check authorization
          if ((!input && (newInput.value !== 'N' || newInput.comment !== '')) 
              || (input && newInput.value !== input.value)
              || (input && newInput.comment !== input.comment)) {
            debug('Create new input');
            input = new ChecklistItemData({
              item: item._id,
              checklist: checklist._id,
              value: newInput.value,
              comment: newInput.comment,
              inputOn: new Date(),
              inputBy: req.session.userid
            });
            pms.push(input.save().catch(function (err) {
              console.log('warm: Error saving ChecklistItemData: ' + err);
              return Promise.reject({
                error: err,
                status: 500,
                body: {
                  error: {
                    message: 'error saving checklist data'
                  }
                }
              });
            }));
          }
        }
      }
    }

    return Promise.all([checklist, Promise.all(pms)]);
  })

  .then(function () {
    return res.status(200).json({});
  })
  
  .catch(respondOnError);
});

module.exports = checklists;

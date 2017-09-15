/**
 * Route handlers for checklists.
 */
import express = require('express');
import mongoose = require('mongoose');
import debugging = require('debug');

import log = require('../lib/log');
import auth = require('../shared/auth');
import handlers = require('../shared/handlers');
import models = require('../shared/models');

import checklist_model = require('../models/checklist');


type ObjectId = models.ObjectId;

type Checklist = checklist_model.Checklist;
type ChecklistItem = checklist_model.ChecklistItem;
type ChecklistItemCfg = checklist_model.ChecklistItemCfg;
type ChecklistItemData = checklist_model.ChecklistItemData;

interface ClientChecklist {
  _id?: string;
  target?: string;
  type?: string;
  items?: ChecklistItem[];
  data?: ChecklistItemData[];
};

interface ClientChecklistItem {
  _id?: string;
  type?: string;
  subject?: string;
  checklist?: string;
  order?: number;
  assignee?: string;
  required?: boolean;
  mandatory?: boolean;
  final?: boolean;
}

interface ClientChecklistItemData {
  _id?: string;
  checklist?: string;
  item?: string;
  value?: string;
  comment?: string;
  inputOn?: string;
  inputBy?: string;
};


const debug = debugging('runcheck:checklists');

export const router = express.Router();

const catchAll = handlers.catchAll;
const HttpStatus = handlers.HttpStatus;
const RequestError = handlers.RequestError;

const ObjectId = mongoose.Types.ObjectId;
const Checklist = checklist_model.Checklist;
const ChecklistItem = checklist_model.ChecklistItem;
const ChecklistItemCfg = checklist_model.ChecklistItemCfg;
const ChecklistItemData = checklist_model.ChecklistItemData;
const checklistValues = checklist_model.checklistValues;


async function findChecklistById(id: string, lean: true): Promise<Object>;
async function findChecklistById(id: string, lean?: false ): Promise<Checklist>;
async function findChecklistById(id: string, lean?: boolean) {
  let checklist: Checklist | Object | null;
  if (lean) {
    checklist = await Checklist.findById(id).lean(true).exec();
  } else {
    checklist = await Checklist.findById(id).exec();
  }
  if (!checklist) {
    throw new RequestError('Checklist not found', HttpStatus.NOT_FOUND);
  }
  return checklist;
};


async function findItemsForChecklist(cl: Checklist): Promise<ChecklistItem[]> {
  let query = ChecklistItem.find({
    type: cl.type,
    checklist: { $in: [null, cl._id ] },
  });
  let items = await query.exec();

  let prms = new Array<Promise<ChecklistItem>>();
  for (let item of items) {
    prms.push(item.populate('__updates').execPopulate());
  }
  await Promise.all(prms);

  return items;
};


async function findItemCfgsForChecklist(cl: Checklist): Promise<ChecklistItemCfg[]> {
  let query = ChecklistItemCfg.find({
    checklist: cl._id,
  });
  let cfgs = await query.exec();

  let prms = new Array<Promise<ChecklistItemCfg>>();
  for (let cfg of cfgs) {
    prms.push(cfg.populate('__updates').execPopulate());
  }
  await Promise.all(prms);

  return cfgs;
};


async function findItemDataForChecklist(cl: Checklist): Promise<ChecklistItemData[]> {
  let query = ChecklistItemData.find({
    checklist: cl._id,
  });
  let datas = await query.exec();

  let prms = new Array<Promise<ChecklistItemData>>();
  for (let data of datas) {
    prms.push(data.populate('__updates').execPopulate());
  }
  await Promise.all(prms);

  return datas;
};


router.get('/:id/json', auth.ensureAuthenticated, catchAll(async (req, res) => {
  let checklist = await findChecklistById(req.params.id);

  let [items, cfgs, data ] = await Promise.all([
    findItemsForChecklist(checklist),
    findItemCfgsForChecklist(checklist),
    findItemDataForChecklist(checklist),
  ]);

  let cfgMap = new Map<string, ChecklistItemCfg>();
  if (cfgs.length > 0) {
    for (let cfg of cfgs) {
      cfgMap.set(cfg.item.toHexString(), cfg);
    }
    for (let item of items) {
      if (item.id) {
        let cfg = cfgMap.get(item.id);
        if (cfg) {
          item.applyCfg(cfg);
        }
      }
    }
  }

  let client: ClientChecklist = {
    _id: checklist.id,
    target: checklist.target.toHexString(),
    type: checklist.type,
    items: items,
    data: data,
  };

  res.status(200).json(client);
}));


router.put('/:id/items/json', auth.ensureAuthenticated, catchAll(async (req, res) => {
  // Ensures the session exists and saves type checks.
  if (!req.session) {
    throw new RequestError('Session not found', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!Array.isArray(req.body)) {
    throw new RequestError('Invalid request data', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }

  let checklist = await findChecklistById(req.params.id);

  let [items, cfgs ] = await Promise.all([
    findItemsForChecklist(checklist),
    findItemCfgsForChecklist(checklist),
  ]);

  // A checklist is custom if it is associated with a checklist
  function isCustom(item: ChecklistItem): boolean {
    return item.checklist && (item.checklist.equals(checklist._id));
  }

  let cfgMap = new Map<string, ChecklistItemCfg>();
  for (let cfg of cfgs) {
    if (cfg.item) {
      cfgMap.set(cfg.item.toHexString(), cfg);
    }
  }

  let itemMap = new Map<string, ChecklistItem>();
  for (let item of items) {
    if (item.id) {
      itemMap.set(item.id, item);
    }
  }

  let newItemSet = new Set<string>();
  let itemPms = new Array<Promise<ChecklistItem> | ChecklistItem>();
  let cfgPms = new Array<Promise<ChecklistItemCfg> | ChecklistItemCfg>();
  for (let newItem of <ClientChecklistItem[]> req.body) {
    if (typeof newItem._id !== 'string') {
      log.warn('Submitted checklist item missing _id');
      continue;
    }
    newItemSet.add(newItem._id);

    let item = itemMap.get(newItem._id);
    let cfg = cfgMap.get(newItem._id);
    if (item) {
      itemPms.push(new ChecklistItem(item));
      debug('Update ChecklistItem (%s) with subject: %s', item._id, item.subject);
    } else {
      item = new ChecklistItem({
        _id: ObjectId(),
        type: checklist.type,
        checklist: checklist._id,
        subject: 'SUBJECT',
      });

      if (typeof newItem.subject === 'string') {
        item.subject = newItem.subject;
      }

      debug('Add new ChecklistItem (%s) with subject: %s', item._id, item.subject);

      let opts = {
        userid: req.session.userid,
        desc: 'Add checklist item',
      };

      itemPms.push(item.saveWithHistory(opts).catch((err) => {
        log.error('Error saving new ChecklistItem: ' + err);
        return Promise.reject(err);
      }));
    }

    if (isCustom(item)) {
      if (typeof newItem.subject === 'string') {
        if (cfg && (typeof cfg.subject === 'string')) {
          if (cfg.subject !== newItem.subject) {
            if (item.subject !== newItem.subject) {
              cfg.subject = newItem.subject;
            } else {
              cfg.subject = undefined; // defer to item
            }
          }
        } else {
          if (item.subject !== newItem.subject) {
            if (!cfg) {
              cfg = new ChecklistItemCfg({
                item: item._id,
                type: checklist.type,
                checklist: checklist._id,
              });
            }
            cfg.subject = newItem.subject;
          }
        }
      } else {
        log.error('warn: ChecklistItem property, "subject", expecting type String');
      }
    }

    if (!item.mandatory) {
      if (typeof newItem.required === 'boolean') {
        if (cfg && (typeof cfg.required === 'boolean')) {
          if (cfg.required !== newItem.required) {
            if (item.required !== newItem.required) {
              cfg.required = newItem.required;
            } else {
              cfg.required = undefined; // defer to item
            }
          }
        } else {
          if (item.required !== newItem.required) {
            if (!cfg) {
              cfg = new ChecklistItemCfg({
                item: item._id,
                type: checklist.type,
                checklist: checklist._id,
              });
            }
            cfg.required = newItem.required;
          }
        }
      } else {
        log.error('warn: ChecklistItem property, "required", expecting type Boolean');
      }
    }

    if (typeof newItem.assignee === 'string') {
      if (cfg && (typeof cfg.assignee === 'string')) {
        if (cfg.assignee !== newItem.assignee) {
          if (item.assignee !== newItem.assignee) {
            cfg.assignee = newItem.assignee;
          } else {
            cfg.assignee = undefined; // defer to item
          }
        }
      } else {
        if (item.assignee !== newItem.assignee) {
          if (!cfg) {
            cfg = new ChecklistItemCfg({
              item: item._id,
              type: checklist.type,
              checklist: checklist._id,
            });
          }
          cfg.assignee = newItem.assignee;
        }
      }
    } else {
      log.error('warn: ChecklistItem property, "assignee", expecting String');
    }

    if (cfg) {
      if (cfg.isModified()) {
        debug('save ChecklistItemCfg: %s', cfg._id);
        let opts = {
          userid: req.session.userid,
          desc: 'Update checklist item',
        };
        cfgPms.push(cfg.saveWithHistory(opts).catch((err) => {
          log.error('warn: Error saving ChecklistItemCfg (%s): %s', cfg ? cfg._id : 'undefined', err);
          return Promise.reject(err);
        }));
      } else {
        cfgPms.push(cfg);
      }
    }
  }

  let rmItemPms = new Array<Promise<ChecklistItem>>();
  for (let item of items) {
    if (isCustom(item) && !newItemSet.has(item._id)) {
      rmItemPms.push(item.remove().catch((err) => {
        log.error('warn: Error removing ChecklistItem (%s):', item._id, err);
        return Promise.reject(err);
      }));
      debug('Remove ChecklistItem: %s', item._id);
    }
  }

  await Promise.all([checklist, Promise.all(itemPms), Promise.all(cfgPms), Promise.all(rmItemPms)]);

  res.status(200).json({});
}));


router.put('/:id/inputs/json', auth.ensureAuthenticated, catchAll(async (req, res) => {
  // Ensures the session exists and saves type checks.
  if (!req.session) {
    throw new RequestError('Session not found');
  }

  if (!Array.isArray(req.body)) {
    throw new RequestError('Invalid request data', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }

  let checklist = await findChecklistById(req.params.id);

  let [ items, cfgs, data ] = await Promise.all([
    findItemsForChecklist(checklist),
    findItemCfgsForChecklist(checklist),
    findItemDataForChecklist(checklist),
  ]);

  let cfgMap = new Map<string, ChecklistItemCfg>();

  for (let cfg of cfgs) {
    cfgMap.set(cfg.item.toHexString(), cfg);
  }

  let itemMap = new Map<string, ChecklistItem>();
  for (let item of items) {
    if (item.id) {
      itemMap.set(item.id, item);
      let cfg = cfgMap.get(item.id);
      if (cfg) {
        item.applyCfg(cfg);
      }
    }
  }

  let inputMap = new Map<string, ChecklistItemData>();
  for (let input of data) {
    inputMap.set(input.item.toHexString(), input);
  }

  let prms = new Array<Promise<ChecklistItemData>>();
  for (let newInput of <ClientChecklistItemData[]> req.body) {
    if (typeof newInput._id !== 'string') {
      log.warn('Submitted checklist item data missing _id');
      continue;
    }
    let item = itemMap.get(newInput._id);
    let input = inputMap.get(newInput._id);
    if (typeof newInput._id === 'string') {
      if (item && (item.mandatory || item.required)) {
        debug('Input permitted: value: "%s", comment:"%s"', newInput.value, newInput.comment);
        // TODO: check authorization
        if (input) {
          if (newInput.value && (newInput.value !== input.value) && (checklistValues.indexOf(newInput.value) !== -1)) {
            debug('Update input value: %s', newInput.value);
            input.value = newInput.value;
            input.inputOn = new Date();
            input.inputBy = req.session.userid;
          }
          if ((newInput.comment !== input.comment) && (typeof newInput.comment === 'string')) {
            debug('Update input comment: %s', newInput.comment);
            input.comment = newInput.comment;
            input.inputOn = new Date();
            input.inputBy = req.session.userid;
          }

          if (input.isModified()) {
            prms.push(input.saveWithHistory(req.session.userid).catch((err) => {
              log.error('Error saving ChecklistItemData: %s', err);
              return Promise.reject(err);
            }));
          }
        } else {
          debug('No existing input found');
          debug(newInput.value !== 'N');
          debug(newInput.value);
          debug(checklistValues);
          if (newInput.value && (newInput.value !== 'N') && (checklistValues.indexOf(newInput.value) !== -1)) {
            debug('Crete input: value: %s, comment: %s', newInput.value, newInput.comment);
            input = new ChecklistItemData({
              item: item._id,
              checklist: checklist._id,
              value: newInput.value,
              comment: newInput.comment,
              inputOn: new Date(),
              inputBy: req.session.userid,
            });
            prms.push(input.saveWithHistory(req.session.userid).catch((err) => {
              log.error('Error saving ChecklistItemData: %s', err);
              return Promise.reject(err);
            }));
          }
        }
      }
    }
  }

  await Promise.all(prms);

  res.status(200).json({});
}));

/**
 * Route handlers for checklists.
 */
import * as dbg  from 'debug';
import * as express from 'express';
import * as mongoose from 'mongoose';

import * as auth from '../shared/auth';
import * as log from '../shared/logging';
import * as models from '../shared/models';

import {
  catchAll,
  ensureAccepts,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import {
  Device,
} from '../models/device';

import {
  Checklist,
  CHECKLIST_VALUES,
  ChecklistConfig,
  ChecklistStatus,
  ChecklistSubject,
} from '../models/checklist';


const debug = dbg('runcheck:checklists');


async function findChecklistSubjects(cl: Checklist): Promise<ChecklistSubject[]> {
  let query = ChecklistSubject.find({
    checklistType: cl.checklistType,
    checklistId: { $in: [null, cl._id] },
  });
  let items = await query.sort('order').exec();

  let prms = new Array<Promise<void>>();
  for (let item of items) {
    prms.push(item.populateUpdates());
  }
  await Promise.all(prms);

  return items;
};


async function findChecklistConfigs(cl: Checklist): Promise<ChecklistConfig[]> {
  let query = ChecklistConfig.find({
    checklist: cl._id,
  });
  let cfgs = await query.exec();

  let prms = new Array<Promise<void>>();
  for (let cfg of cfgs) {
    prms.push(cfg.populateUpdates());
  }
  await Promise.all(prms);

  return cfgs;
};


async function findChecklistStatuses(cl: Checklist): Promise<ChecklistStatus[]> {
  let query = ChecklistStatus.find({
    checklist: cl._id,
  });
  let datas = await query.exec();

  let prms = new Array<Promise<void>>();
  for (let data of datas) {
    prms.push(data.populateUpdates());
  }
  await Promise.all(prms);

  return datas;
};



export const router = express.Router();

router.get('/:id', ensureAccepts('json'), catchAll(async (req, res) => {
  const id = String(req.params.id);

  debug('Find Checklist with id: %s', id);
  let checklist = await Checklist.findById(id);
  if (!checklist || !checklist.id) {
    throw new RequestError('Checklist not found', HttpStatus.NOT_FOUND);
  }

  // Defer these results until they are needed later.
  let deferred = Promise.all([
    findChecklistSubjects(checklist),
    findChecklistConfigs(checklist),
    findChecklistStatuses(checklist),
  ]);

  let varRoleMap = new Map<string, string>();

  if (checklist.targetType === Device.modelName) {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    varRoleMap.set('VAR:DEPT_LEADER', 'GRP:' + device.dept + '#LEADER');
  } else {
    throw new RequestError('Target type not supported: ' + checklist.targetType);
  }

  let [subjects, configs, statuses ] = await deferred;

  const webChecklist: webapi.Checklist = {
    id: String(checklist.id),
    targetId: checklist.targetId.toHexString(),
    type: checklist.checklistType,
    items: [],
    data: [],
  };

  for (let subject of subjects) {
    if (subject.id) {
      for (let cfg of configs) {
        if (cfg.subjectId.equals(subject._id)) {
          subject.applyCfg(cfg);
          break;
        }
      }

      let assignees: string[] = [];
      for (let assignee of subject.assignees) {
        // TODO: use URL parser and handle fragment
        let role = varRoleMap.get(assignee);
        if (role) {
          debug('Replace assignee: %s => %s', assignee, role);
          assignees.push(role);
        } else {
          assignees.push(assignee);
        }
      }

      webChecklist.items.push({
        id: subject.id,
        type: subject.ChecklistType,
        checklistId: checklist.id,
        order: subject.order,
        subject: subject.name,
        assignee: assignees,
        required: subject.required,
        mandatory: subject.mandatory,
        final: subject.final,
      });
    }
  }

  for (let status of statuses) {
    if (status.id) {
      webChecklist.data.push({
        id: status.id,
        checklistId: checklist.id,
        itemId: status.subjectId.toHexString(),
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: String(status.inputOn),
      });
    }
  }

  res.json(<webapi.Data<webapi.Checklist>> {
    data: webChecklist,
  });
}));

/*
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
*/

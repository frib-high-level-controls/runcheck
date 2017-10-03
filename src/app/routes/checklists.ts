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
  IChecklistStatus,
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
    checklistId: cl._id,
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
    checklistId: cl._id,
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
  debug('Checklist subjects: %s', subjects.length);
  debug('Checklist configs: %s', configs.length);
  debug('Checklist statuses: %s', statuses.length);

  const webChecklist: webapi.Checklist = {
    id: String(checklist.id),
    targetId: checklist.targetId.toHexString(),
    type: checklist.checklistType,
    subjects: [],
    statuses: [],
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

      webChecklist.subjects.push({
        id: subject.id,
        checklistType: subject.ChecklistType,
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
      //let webUpdate
      let webUpdates: webapi.Update[] = [];

      if (status.history.updates) {
        for (let update of status.history.updates) {
          webUpdates.push({
            at: String(update.at),
            by: update.by,
            paths: update.paths,
          });
        }
      }

      let webStatus = {
        id: status.id,
        checklistId: status.checklistId.toHexString(),
        subjectId: status.subjectId.toHexString(),
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: status.inputOn.toISOString(),
        history: {
          updatedAt: status.history.updatedAt.toISOString(),
          updatedBy: status.history.updatedBy,
          updates: webUpdates,
        },
      };

      webChecklist.statuses.push(webStatus);
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
*/

router.put('/:id/statuses', ensureAccepts('json'), auth.ensureAuthenticated, catchAll(async (req, res) => {
  let id = String(req.params.id);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request.');
  }

  if (!Array.isArray(req.body.data)) {
    throw new RequestError('Invalid request data', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  let checklist = await Checklist.findById(id).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', HttpStatus.NOT_FOUND);
  }

  let deferred = await Promise.all([
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

  let [ subjects, configs, statuses ] = await deferred;

  const configMap = new Map<string, ChecklistConfig>();
  for (let config of configs) {
    configMap.set(config.subjectId.toHexString(), config);
  }

  const subjectMap = new Map<string, ChecklistSubject>();
  for (let subject of subjects) {
    if (subject.id) {
      subjectMap.set(subject.id, subject);
      let config = configMap.get(subject.id);
      if (config) {
        subject.applyCfg(config);
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
    subject.assignees = assignees;
  }

  let statusMap = new Map<string, ChecklistStatus>();
  for (let status of statuses) {
    statusMap.set(status.subjectId.toHexString(), status);
  }

  let prms = new Array<Promise<ChecklistStatus>>();
  for (let newStatus of <any[]> req.body.data) {
    //if (typeof newStatus.subjectId !== 'string') {
    //  log.warn('Submitted checklist item data missing _id');
    //  continue;
    //}
    let subject = subjectMap.get(newStatus.subjectId);
    let status = statusMap.get(newStatus.subjectId);


    if (subject && (subject.mandatory || subject.required)) {
      debug('Status submitted name: "%s", value: "%s", comment:"%s"', subject.name, newStatus.value, newStatus.comment);
      if (!auth.hasAnyRole(req, [ 'SYS:RUNCHECK' ].concat(subject.assignees))) {
        throw new RequestError('Not Permitted', HttpStatus.FORBIDDEN);
      }

      if (status) {
        if (newStatus.value && (newStatus.value !== status.value) && (CHECKLIST_VALUES.includes(newStatus.value))) {
          debug('Update status value: %s', newStatus.value);
          status.value = newStatus.value;
          status.inputOn = new Date();
          status.inputBy = username;
        }
        if ((newStatus.comment !== status.comment) && (typeof newStatus.comment === 'string')) {
          debug('Update status comment: %s', newStatus.comment);
          status.comment = newStatus.comment;
          status.inputOn = new Date();
          status.inputBy = username;
        }

        if (status.isModified()) {
          prms.push(status.saveWithHistory(username).catch((err) => {
            log.error('Error saving ChecklistStatus: %s', err);
            return Promise.reject(err);
          }));
        }
      } else {
        debug('Create new checklist status');
        debug(newStatus.value !== 'N');
        debug(newStatus.value);
        debug(CHECKLIST_VALUES);
        if (newStatus.value && (newStatus.value !== 'N') && (CHECKLIST_VALUES.includes(newStatus.value))) {
          debug('Crete input: value: %s, comment: %s', newStatus.value, newStatus.comment);
          status = new ChecklistStatus(<IChecklistStatus> {
            subjectId: subject._id,
            checklistId: checklist._id,
            value: newStatus.value,
            comment: newStatus.comment,
            inputOn: new Date(),
            inputBy: username,
          });
          prms.push(status.saveWithHistory(username).catch((err) => {
            log.error('Error saving ChecklistStatus: %s', err);
            return Promise.reject(err);
          }));
        }
      }
    }
  }

  await Promise.all(prms);

  let data: webapi.ChecklistStatus[] = [];
  for (let status of statuses) {
    if (status.id) {
      //let webUpdate
      let webUpdates: webapi.Update[] = [];

      if (status.history.updates) {
        for (let update of status.history.updates) {
          webUpdates.push({
            at: String(update.at),
            by: update.by,
            paths: update.paths,
          });
        }
      }

      let webStatus = {
        id: status.id,
        checklistId: status.checklistId.toHexString(),
        subjectId: status.subjectId.toHexString(),
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: status.inputOn.toISOString(),
        history: {
          updatedAt: status.history.updatedAt.toISOString(),
          updatedBy: status.history.updatedBy,
          updates: webUpdates,
        },
      };

      data.push(webStatus);
    }
  }

  res.json(<webapi.Data<webapi.ChecklistStatus[]>> {
    data: data,
  });
}));

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
  Slot,
} from '../models/slot';

import {
  Group,
} from '../models/group';

import {
  Checklist,
  CHECKLIST_VALUES,
  ChecklistConfig,
  ChecklistStatus,
  ChecklistSubject,
  IChecklistConfig,
  IChecklistStatus,
  IChecklistSubject,
} from '../models/checklist';


const debug = dbg('runcheck:checklists');


// async function findChecklistSubjects(cl: Checklist): Promise<ChecklistSubject[]> {
//   let query = ChecklistSubject.find({
//     checklistType: cl.checklistType,
//     checklistId: { $in: [null, cl._id] },
//   });
//   let items = await query.sort('order').exec();

//   let prms = new Array<Promise<void>>();
//   for (let item of items) {
//     prms.push(item.populateUpdates());
//   }
//   await Promise.all(prms);

//   return items;
// };


// async function findChecklistConfigs(cl: Checklist): Promise<ChecklistConfig[]> {
//   let query = ChecklistConfig.find({
//     checklistId: cl._id,
//   });
//   let cfgs = await query.exec();

//   let prms = new Array<Promise<void>>();
//   for (let cfg of cfgs) {
//     prms.push(cfg.populateUpdates());
//   }
//   await Promise.all(prms);

//   return cfgs;
// };


// async function findChecklistStatuses(cl: Checklist): Promise<ChecklistStatus[]> {
//   let query = ChecklistStatus.find({
//     checklistId: cl._id,
//   });
//   let datas = await query.exec();

//   let prms = new Array<Promise<void>>();
//   for (let data of datas) {
//     prms.push(data.populateUpdates());
//   }
//   await Promise.all(prms);

//   return datas;
// };



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
    //findChecklistSubjects(checklist),
    ChecklistSubject.findWithHistory({
      checklistType: checklist.checklistType,
      checklistId: { $in: [null, checklist._id] },
    }),
    //findChecklistConfigs(checklist),
    ChecklistConfig.findWithHistory({
      checklistId : checklist._id,
    }),
    //findChecklistStatuses(checklist),
    ChecklistStatus.findWithHistory({
      checklistId : checklist._id,
    }),
  ]);

  let ownerRole = '';
  let varRoleMap = new Map<string, string>();

  if (checklist.targetType === Device.modelName) {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    ownerRole = 'GRP:' + device.dept + '#LEADER';
    varRoleMap.set('VAR:DEPT_LEADER', ownerRole);
  } else if (checklist.targetType === Slot.modelName) {
    let slot = await Slot.findById(checklist.targetId).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    varRoleMap.set('VAR:AREA_LEADER', 'GRP:' + slot.area + '#LEADER');
  } else if (checklist.targetType === Group.modelName) {
    let slot = await Slot.findOne({ groupId: checklist.targetId }).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    varRoleMap.set('VAR:AREA_LEADER', 'GRP:' + slot.area + '#LEADER');
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
    editable: auth.hasAnyRole(req, [ 'SYS:RUNCHECK', ownerRole ]),
    subjects: [],
    statuses: [],
  };

  for (let subject of subjects) {
    if (subject.id) {
      for (let cfg of configs) {
        if (cfg.subjectName === subject.name) {
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
        checklistType: subject.checklistType,
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
      //let webHistory: webapi.History | undefined;
      //let webUpdates: webapi.Update[] = [];
      const h = status.history;
      let webHistory: webapi.History = {
        updates: [],
        updatedAt: h.updatedAt ? h.updatedAt.toISOString() : '',
        updatedBy: h.updatedBy || '',
      };
      if (h.updates) {
        for (let update of h.updates) {
          webHistory.updates.push({
            at: String(update.at),
            by: update.by,
            paths: update.paths,
          });
        }
      }

      let webStatus = {
        id: status.id,
        checklistId: status.checklistId.toHexString(),
        subjectId: status.subjectName,
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: status.inputOn.toISOString(),
        history: webHistory,
      };

      webChecklist.statuses.push(webStatus);
    }
  }

  res.json(<webapi.Pkg<webapi.Checklist>> {
    data: webChecklist,
  });
}));


router.put('/:id/subjects', ensureAccepts('json'), auth.ensureAuthenticated, catchAll(async (req, res) => {
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

  // A checklist is custom if it is associated with a checklist
  function isCustom(subject: ChecklistSubject): boolean {
    if (!checklist || !subject.checklistId) {
      return false;
    }
    return subject.checklistId.equals(checklist._id);
  }

  let deferred = Promise.all([
    //findChecklistSubjects(checklist),
    ChecklistSubject.findWithHistory({
      checklistType: checklist.checklistType,
      checklistId: { $in: [null, checklist._id] },
    }),
    //findChecklistConfigs(checklist),
    ChecklistConfig.findWithHistory({
      checklistId: checklist._id,
    }),
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

  let [subjects, configs ] = await deferred;

  let cfgMap = new Map<string, ChecklistConfig>();
  for (let config of configs) {
    //if (config.subjectId) {
    cfgMap.set(config.subjectName, config);
    //}
  }

  let subjectMap = new Map<string, ChecklistSubject>();
  for (let subject of subjects) {
    if (subject.id) {
      subjectMap.set(subject.id, subject);
    }
  }

  let newItemSet = new Set<string>();
  let itemPms = new Array<Promise<ChecklistSubject>>();
  let cfgPms = new Array<Promise<ChecklistConfig>>();
  for (let newSubject of <webapi.ChecklistSubject[]> req.body.data) {
    if (typeof newSubject.id !== 'string') {
      log.warn('Submitted checklist item missing _id');
      continue;
    }
    newItemSet.add(newSubject.id);

    let subject = subjectMap.get(newSubject.id);
    let cfg = cfgMap.get(newSubject.id);
    if (subject) {
      itemPms.push(Promise.resolve(new ChecklistSubject(subject)));
      debug('Update ChecklistItem (%s) with subject: %s', subject._id, subject.name);
    } else {
      subject = new ChecklistSubject(<IChecklistSubject> {
        //_id: models.generateId(),
        checklistType: checklist.checklistType,
        checklistId: models.ObjectId(checklist._id),
        name: 'SUBJECT',
      });

      subject._id = models.generateId();

      if (typeof newSubject.subject === 'string') {
        subject.name = newSubject.subject;
      }

      debug('Add new ChecklistItem (%s) with subject: %s', subject.id, subject.name);

      // let opts = {
      //   userid: username,
      //   desc: 'Add checklist item',
      // };

      itemPms.push(subject.saveWithHistory(username).catch((err) => {
        log.error('Error saving new ChecklistItem: ' + err);
        return Promise.reject(err);
      }));
    }

    if (isCustom(subject)) {
      if (typeof newSubject.subject === 'string') {
        if (cfg && (typeof cfg.name === 'string')) {
          if (cfg.name !== newSubject.subject) {
            if (subject.name !== newSubject.subject) {
              cfg.name = newSubject.subject;
            } else {
              cfg.name = undefined; // fallback to subject
            }
          }
        } else {
          if (subject.name !== newSubject.subject) {
            if (!cfg) {
              cfg = new ChecklistConfig(<IChecklistConfig> {
                subjectName: subject.name,
                checklistType: checklist.checklistType,
                checklistId: models.ObjectId(checklist._id),
              });
            }
            cfg.name = newSubject.subject;
          }
        }
      } else {
        log.error('warn: ChecklistSubject property, "name", expecting type String');
      }
    }

    if (!subject.mandatory) {
      if (typeof newSubject.required === 'boolean') {
        if (cfg && (typeof cfg.required === 'boolean')) {
          if (cfg.required !== newSubject.required) {
            if (subject.required !== newSubject.required) {
              cfg.required = newSubject.required;
            } else {
              cfg.required = undefined; // defer to item
            }
          }
        } else {
          if (subject.required !== newSubject.required) {
            if (!cfg) {
              cfg = new ChecklistConfig(<IChecklistConfig> {
                subjectName: subject.name,
                checklistType: checklist.checklistType,
                checklistId: models.ObjectId(checklist._id),
              });
            }
            cfg.required = newSubject.required;
          }
        }
      } else {
        log.error('warn: ChecklistItem property, "required", expecting type Boolean');
      }
    }

    // if (typeof newSubject.assignee === 'string') {
    //   if (cfg && (typeof cfg.assignee === 'string')) {
    //     if (cfg.assignee !== newSubject.assignee) {
    //       if (item.assignee !== newSubject.assignee) {
    //         cfg.assignee = newSubject.assignee;
    //       } else {
    //         cfg.assignee = undefined; // defer to item
    //       }
    //     }
    //   } else {
    //     if (item.assignee !== newItem.assignee) {
    //       if (!cfg) {
    //         cfg = new ChecklistItemCfg({
    //           item: item._id,
    //           type: checklist.type,
    //           checklist: checklist._id,
    //         });
    //       }
    //       cfg.assignee = newSubject.assignee;
    //     }
    //   }
    // } else {
    //   log.error('warn: ChecklistItem property, "assignee", expecting String');
    // }

    if (cfg) {
      if (cfg.isModified()) {
        debug('save ChecklistItemCfg: %s', cfg._id);
        // let opts = {
        //   userid: req.session.userid,
        //   desc: 'Update checklist item',
        // };
        cfgPms.push(cfg.saveWithHistory(username).catch((err) => {
          log.error('warn: Error saving ChecklistItemCfg (%s): %s', cfg ? cfg._id : 'undefined', err);
          return Promise.reject(err);
        }));
      } else {
        cfgPms.push(Promise.resolve(cfg));
      }
    }
  }

  let rmItemPms = new Array<Promise<ChecklistSubject>>();
  for (let subject of subjects) {
    if (isCustom(subject) && !newItemSet.has(subject._id)) {
      rmItemPms.push(subject.remove().catch((err) => {
        log.error('warn: Error removing ChecklistItem (%s):', subject.id, err);
        return Promise.reject(err);
      }));
      debug('Remove ChecklistItem: %s', subject.id);
    }
  }

  await Promise.all([checklist, Promise.all(itemPms), Promise.all(cfgPms), Promise.all(rmItemPms)]);

  res.status(200).json({});
}));


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

  let deferred = Promise.all([
    //findChecklistSubjects(checklist),
    ChecklistSubject.findWithHistory({
      checklistType: checklist.checklistType,
      checklistId: { $in: [null, checklist._id] },
    }),
    //findChecklistConfigs(checklist),
    ChecklistConfig.findWithHistory({
      checklistId : checklist._id,
    }),
    //findChecklistStatuses(checklist),
    ChecklistStatus.findWithHistory({
      checklistId : checklist._id,
    }),
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
    configMap.set(config.subjectName, config);
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
    statusMap.set(status.subjectName, status);
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
            subjectName: subject.name,
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
  // for (let status of statuses) {
  //   if (status.id) {
  //     //let webUpdate
  //     let webUpdates: webapi.Update[] = [];

  //     if (status.history.updates) {
  //       for (let update of status.history.updates) {
  //         webUpdates.push({
  //           at: String(update.at),
  //           by: update.by,
  //           paths: update.paths,
  //         });
  //       }
  //     }

  //     let webStatus = {
  //       id: status.id,
  //       checklistId: status.checklistId.toHexString(),
  //       subjectId: status.subjectId.toHexString(),
  //       value: status.value,
  //       comment: status.comment,
  //       inputBy: status.inputBy,
  //       inputOn: status.inputOn.toISOString(),
  //       history: {
  //         updatedAt: status.history.updatedAt.toISOString(),
  //         updatedBy: status.history.updatedBy,
  //         updates: webUpdates,
  //       },
  //     };

  //     data.push(webStatus);
  //   }
  // }

  for (let status of statuses) {
    if (status.id) {
      //let webUpdate
      //let webHistory: webapi.History;
      //let webUpdates: webapi.Update[] = [];


      //if (status.history) {
      let webHistory: webapi.History = {
        updates: [],
        updatedAt: status.history.updatedAt ? status.history.updatedAt.toISOString() : '',
        updatedBy: status.history.updatedBy || '',
      };

      if ( status.history.updates) {
        for (let update of status.history.updates) {
          webHistory.updates.push({
            at: String(update.at),
            by: update.by,
            paths: update.paths,
          });
        }
      }

      //}

      let webStatus = {
        id: status.id,
        checklistId: status.checklistId.toHexString(),
        subjectId: status.subjectName,
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: status.inputOn.toISOString(),
        history: webHistory,
      };

      data.push(<any> webStatus);
      //webChecklist.statuses.push(webStatus);
    }

  }


  res.json(<webapi.Pkg<webapi.ChecklistStatus[]>> {
    data: data,
  });
}));

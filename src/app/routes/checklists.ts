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
  format,
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
  //IChecklistStatus,
  IChecklistSubject,
} from '../models/checklist';

type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;
type ObjectId = mongoose.Types.ObjectId;

interface Target {
  name: string;
  desc: string;
  checklistId?: ObjectId | null;
};


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

function findQueryParam(req: express.Request, name: string): string | undefined {
  // If name is an exact match then do not do case insensitive search.
  if (req.query[name]) {
    return String(req.query[name]);
  }
  name = name.toUpperCase();
  for (let key in req.query) {
    if (req.query.hasOwnProperty(key)) {
      if (key.toUpperCase() === name) {
        return String(req.query(key));
      }
    }
  }
  return;
}

function mapByChecklistId<T extends { checklistId?: ObjectId }>(p: Promise<T[]>, a?: Array<ObjectId | null>): Promise<Map<string, T[]>> {
  let m = new Map<string, T[]>();
  if (a) {
    for (let aa of a) {
      //let checklistId = aa.toHexString();
      if (aa) {
        m.set(aa.toHexString(), []);
      }
    }
  }
  return p.then((docs) => {
    for (let doc of docs) {
      if (doc.checklistId) {
        let checklistId = doc.checklistId.toHexString();
        let group = m.get(checklistId);
        if (group) {
          group.push(doc);
        } else {
          m.set(checklistId, [ doc ]);
        }
      } else {
        for (let group of m.values()) {
          group.push(doc);
        }
      }
    }
    return m;
  });
}


export function ensurePackage(allowError?: boolean) {
  return  (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || (!req.body.data && allowError && !req.body.error)) {
      next(new RequestError('Request body is not a valid data package', HttpStatus.BAD_REQUEST));
    }
    next();
  };
}


export const router = express.Router();


router.get('/', catchAll(async (req, res) => {
  let targetType = findQueryParam(req, 'type');
  debug('Checklist target type: %s', targetType);


  // let qType: string | undefined;
  // for (let name in req.query) {
  //   if (req.query.hasOwnProperty(name)) {
  //     if (name.toUpperCase() === 'TYPE') {
  //       qType = String(req.query[name]).toUpperCase();
  //     }
  //   }
  // }

  // if (!targetType) {
  //   return;
  // }

  return format(res, {
    'text/html': () => {
      res.render('checklists', {
        targetType: targetType,
      });
    },
    'application/json': async () => {
      let targets: Target[];

      switch (String(targetType).toUpperCase()) {
      case 'SLOT':
        debug('Find Slots with assigned checklist');
        targets = await Slot.find({ checklistId: { $exists: true } /*, groupId: { $exists: false }*/}).exec();
        break;
      case 'DEVICE':
        debug('Find Devices with assigned checklist');
        targets = await Device.find({ checklistId: { $exists: true } }).exec();
        break;
      case 'SLOTGROUP':
        debug('Find Groups with assigned checklist');
        targets = await Group.find({ checklistId: { $exists: true }, memberType: Slot.modelName }).exec();
        break;
      default:
        targets = [];
        let [ devices, slots, slotgroups ] = await Promise.all([
          Device.find({ checklistId: { $exists: true } }).exec(),
          Slot.find({ checklistId: { $exists: true } /*, groupId: { $exists: false }*/}).exec(),
          Group.find({ checklistId: { $exists: true }, memberType: Slot.modelName }).exec(),
        ]);
        targets = targets.concat(devices, slots, slotgroups);
        debug(targets.length);
        break;
      }

      let checklistIds: Array<ObjectId | null> = [];
      for (let target of targets) {
        if (target.checklistId) {
          checklistIds.push(target.checklistId);
        }
      }

      debug('Find checklists for targets (length: %s)', checklistIds.length);

      let [ checklists, subjects, configs, statuses ] = await Promise.all([
        models.mapById(Checklist.find({ _id: { $in: checklistIds } }).exec()),
        mapByChecklistId(ChecklistSubject.find({ $or: [{checklistId: { $exists: false }}, {checklistId: { $in: checklistIds.concat(null) }}]}).exec(), checklistIds),
        mapByChecklistId(ChecklistConfig.find({ checklistId: { $in: checklistIds } }).exec()),
        mapByChecklistId(ChecklistStatus.find({ checklistId: { $in: checklistIds } }).exec()),
      ]);

      debug('Found checklists: ', checklists.size);

      let apiChecklists: webapi.Checklist[] = [];
      for (let target of targets) {
        if (!target.checklistId) {
          continue;
        }

        let checklistId = target.checklistId.toHexString();

        let checklist = checklists.get(checklistId);
        if (!checklist) {
          continue;
        }
        let checklistSubjects = subjects.get(checklistId);
        if (!checklistSubjects) {
          continue;
        }

        let checklistConfigs = configs.get(checklistId);
        if (!checklistConfigs) {
          checklistConfigs = [];
        }

        let checklistStatuses = statuses.get(checklistId);
        if (!checklistStatuses) {
          checklistStatuses = [];
        }

        let apiSubjects: webapi.ChecklistSubject[] = [];
        for (let subject of checklistSubjects) {
          for (let config of checklistConfigs) {
            //debug('%s ?= %s', config.checklistId, subject._id);
            //debug('%s ?= %s', config.subjectName, subject.name);
            if (config.subjectName === subject.name) {
              debug('Applying config!');
              subject.applyCfg(config);
              break;
            }
          }

          if (subject.checklistType === checklist.checklistType && (!subject.checklistId || subject.checklistId.equals(checklist._id))) {
            apiSubjects.push({
              //id: '', //String(subject.id),
              name: subject.name,
              desc: subject.desc,
              //checklistId: '', // subject.checklistId ? subject.checklistId.toHexString() : String(checklist.id),
              //checklistType: subject.checklistType,
              order: subject.order,
              assignee: subject.assignees,
              required: subject.required,
              mandatory: subject.mandatory,
              final: subject.final,
            });
          }
        }


        let apiStatuses: webapi.ChecklistStatus[] = [];
        for (let status of checklistStatuses) {
          // if (status.checklistId.equals(checklist._id)) {
            apiStatuses.push({
              // id: '', // String(status.id),
              // checklistId: '', //status.checklistId.toHexString(),
              subjectName: status.subjectName,
              value: status.value,
              comment: status.comment,
              inputBy: status.inputBy,
              inputOn: status.inputAt.toISOString(),
              history: {
                updates: [],
                updatedAt: '',
                updatedBy: '',
              },
            });
          // }
        }

        apiChecklists.push({
          id: String(checklist.id),
          targetId: checklist.targetId.toHexString(),
          targetName: target.name,
          targetDesc: target.desc,
          checklistType: checklist.checklistType,
          //editable: false,
          subjects: apiSubjects,
          statuses: apiStatuses,
        });
      }

      res.json(<webapi.Pkg<webapi.Checklist[]>> {
        data: apiChecklists,
      });

    },
  });

}));



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
    checklistType: checklist.checklistType,
    // editable: auth.hasAnyRole(req, [ 'SYS:RUNCHECK', ownerRole ]),
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
        //id: subject.id,
        //checklistType: subject.checklistType,
        //checklistId: checklist.id,
        order: subject.order,
        name: subject.name,
        desc: subject.desc,
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
        subjectName: status.subjectName,
        value: status.value,
        comment: status.comment,
        inputBy: status.inputBy,
        inputOn: status.inputAt.toISOString(),
        history: webHistory,
      };

      webChecklist.statuses.push(webStatus);
    }
  }

  res.json(<webapi.Pkg<webapi.Checklist>> {
    data: webChecklist,
  });
}));


/**
 * Create a custom checklist subject
 */
router.post('/:id/subjects', ensureAccepts('json'), auth.ensureAuthenticated, catchAll(async (req, res) => {
  let id = String(req.params.id);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request');
  }

  let pkg: { data?: { desc?: string } } = req.body;

  if (!pkg || !pkg.data) {
    throw new RequestError('Request body is not a package', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  if (!pkg.data.desc) {
    throw new RequestError('Subject description is required', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  let checklist = await Checklist.findById(id).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', HttpStatus.NOT_FOUND);
  }


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

  // let [ device, slot, group ] = await Promise.all([
  //   Device.findOne({ checklistId: id }).exec(),
  //   Slot.findOne({ checklistId: id }).exec(),
  //   Group.findOne({ checklistId: id }).exec(),
  // ]);

  // switch(checklist.targetType) {

  // case Device.modelName:
  //   if (!device) {
  //     // ERROR
  //   }
  //   owner = device.dept;
  // }

  // if (checklist.targetType === Device.modelName && !device) {
  //   // ERROR
  // } else if (checklist.targetType == )



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
      subjectMap.set(subject.name, subject);
    }
  }

  let newItemSet = new Set<string>();
  let itemPms = new Array<Promise<ChecklistSubject>>();
  let cfgPms = new Array<Promise<ChecklistConfig>>();
  for (let newSubject of <webapi.ChecklistSubject[]> req.body.data) {
    if (typeof newSubject.name !== 'string') {
      log.warn('Submitted checklist item missing _id');
      continue;
    }
    newItemSet.add(newSubject.name);

    let subject = subjectMap.get(newSubject.name);
    let cfg = cfgMap.get(newSubject.name);
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

      if (typeof newSubject.name === 'string') {
        subject.name = newSubject.name;
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
      if (typeof newSubject.name === 'string') {
        if (cfg && (typeof cfg.name === 'string')) {
          if (cfg.name !== newSubject.name) {
            if (subject.name !== newSubject.name) {
              cfg.name = newSubject.name;
            } else {
              cfg.name = undefined; // fallback to subject
            }
          }
        } else {
          if (subject.name !== newSubject.name) {
            if (!cfg) {
              cfg = new ChecklistConfig(<IChecklistConfig> {
                subjectName: subject.name,
                checklistType: checklist.checklistType,
                checklistId: models.ObjectId(checklist._id),
              });
            }
            cfg.name = newSubject.name;
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

const NOT_FOUND = HttpStatus.NOT_FOUND;
const BAD_REQUEST = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

router.put('/:id/statuses/:name', ensureAccepts('json'), ensurePackage(), auth.ensureAuthenticated, catchAll(async (req, res) => {
  let checklistId = String(req.params.id);
  let subjectName = String(req.params.name);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request.');
  }

  let pkg = <webapi.Pkg<{ value?: {}, comment?: {} }>> req.body;

  // validate the request data

  let statusValue = pkg.data.value ? String(pkg.data.value).trim().toUpperCase() : undefined;
  if (!statusValue) {
    throw new RequestError(`Checklist status value required`, BAD_REQUEST);
  }
  if (!CHECKLIST_VALUES.includes(statusValue)) {
    // if (isChecklistValueValid(statusValue)) {
    throw new RequestError(`Checklist status value invalid: ${statusValue}`, BAD_REQUEST);
  }

  let statusComment = pkg.data.comment ? String(pkg.data.comment).trim() : undefined;
  if (statusValue === 'YC' && !statusComment) {
    // if (isChecklistValueApproved(statusValue, true) && !statusComment)
    throw new RequestError(`Checklist status comment is required`, BAD_REQUEST);
  }

  // if (!Array.isArray(req.body.data)) {
  //   throw new RequestError('Invalid request data', HttpStatus.UNPROCESSABLE_ENTITY);
  // }

  debug('Find checklist by ID: %s', checklistId);
  let checklist = await Checklist.findById(checklistId).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', NOT_FOUND);
  }

  // let deferred = Promise.all([
  //   //findChecklistSubjects(checklist),
  //   ChecklistSubject.findWithHistory({
  //     checklistType: checklist.checklistType,
  //     checklistId: { $in: [null, checklist._id] },
  //   }),
  //   //findChecklistConfigs(checklist),
  //   ChecklistConfig.findWithHistory({
  //     checklistId : checklist._id,
  //   }),
  //   //findChecklistStatuses(checklist),
  //   ChecklistStatus.findWithHistory({
  //     checklistId : checklist._id,
  //   }),
  // ]);

  // let varRoleMap = new Map<string, string>();

  // if (checklist.targetType === Device.modelName) {
  //   let device = await Device.findById(checklist.targetId).exec();
  //   if (!device || !device.id) {
  //     throw new RequestError('Device not found', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  //   varRoleMap.set('VAR:DEPT_LEADER', 'GRP:' + device.dept + '#LEADER');
  // } else {
  //   throw new RequestError('Target type not supported: ' + checklist.targetType);
  // }

  // let [ subjects, configs, statuses ] = await deferred;

  let deferredSlot: Promise<Slot | null> = Promise.resolve(null);
  let deferredGroup: Promise<Group | null> = Promise.resolve(null);
  let deferredDevice: Promise<Device | null> = Promise.resolve(null);

  switch (checklist.targetType) {
  case Slot.modelName:
    debug('Find slot with ID: %s', checklist.targetId);
    deferredSlot = Slot.findById(checklist.targetId).exec();
    break;
  case Group.modelName:
    debug('Find group with ID: %s', checklist.targetId);
    deferredGroup = Group.findById(checklist.targetId).exec();
    break;
  case Device.modelName:
    debug('Find device with ID: %s', checklist.targetId);
    deferredDevice = Device.findById(checklist.targetId).exec();
    break;
  default:
    throw new RequestError(`Checklist target type invalid: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [ subjects, configs, statuses, device, slot, group ] = await Promise.all([
    models.mapById(ChecklistSubject.find({
      $or: [{
        checklistType: checklist.checklistType,
        checklistId: { $exists: false }, // TODO: exists(false)
        name: subjectName,
      }, {
        checklistType: checklist.checklistType,
        checklistId: { $in: [null, checklist._id] }, // TODO: exists(false)
        name: subjectName,
      }],
    }).exec()),
    models.mapByPath('subjectName', ChecklistConfig.find({
      checklistId: checklist._id,
      subjectName: subjectName,
    }).exec()),
    models.mapByPath('subjectName', ChecklistStatus.find({
      checklistId: checklist._id,
      subjectName: subjectName,
    }).exec()),
    deferredDevice, deferredSlot, deferredGroup,
  ]);

  if (!subjects.has(subjectName)) {
    throw new RequestError('Checklist subject not found', NOT_FOUND);
  }

  let varRoleMap = new Map<string, string>();

  switch (checklist.targetType) {
  case Slot.modelName:
    if (slot) {
      //debug('')
      //let role = auth.formatRole('GRP', slot.area, 'LEADER');
      //debug('')
      varRoleMap.set('AREA_LEADER', auth.formatRole('GRP', slot.area, 'LEADER'));
    } else {
      throw new RequestError('Slot not found', NOT_FOUND);
    }
    
    break;
  case Device.modelName:
    if (!device) {
      throw new RequestError('Device not found', NOT_FOUND);
    }
    varRoleMap.set('DEPT_LEADER', auth.formatRole('GRP', device.dept, 'LEADER'));
    break;
  case Group.modelName:
    if (!group) {
      throw new RequestError('Group not found', NOT_FOUND);
    }
    switch (group.memberType) {
    case Slot.modelName:
      varRoleMap.set('AREA_LEADER', auth.formatRole('GRP', 'TODO', 'LEADER'));
      break;
    case Device.modelName:
      varRoleMap.set('DEPT_LEADER', auth.formatRole('GRP', 'TODO', 'LEADER'));
      break;
    default:
      throw new RequestError(`Group member type invalid: ${group.memberType}`, INTERNAL_SERVER_ERROR);
    }
    break;
  default:
    throw new RequestError(`Checklist target type invalid: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  // TODO: Common function
  for (let subject of subjects.values()) {
    let config = configs.get(subject.name);
    if (config) {
      subject.applyCfg(config);
    }
    let assignees: string[] = [];
    for (let assignee of subject.assignees) {
      let role = auth.parseRole(assignee);
      if (!role) {
        // RequestError('Assignee role is malformed', INTERNAL_SERVER_ERROR);
        // LOG!
        continue;
      }
      if (role.scheme !== 'VAR') {
        assignees.push(auth.formatRole(role));
        continue;
      }
      let varRole = varRoleMap.get(role.identifier);
      if (!varRole) {
        // LOG throw new RequestError('Variable role is undefined', INTERNAL_SERVER_ERROR);
        continue
      }
      assignees.push(varRole);
    }
    subject.assignees = assignees;
  }

  // const configMap = new Map<string, ChecklistConfig>();
  // for (let config of configs) {
  //   configMap.set(config.subjectName, config);
  // }

  // const subjectMap = new Map<string, ChecklistSubject>();
  // for (let subject of subjects) {
  //   if (subject.id) {
  //     subjectMap.set(subject.id, subject);
  //     let config = configMap.get(subject.id);
  //     if (config) {
  //       subject.applyCfg(config);
  //     }
  //   }

  //   let assignees: string[] = [];
  //   for (let assignee of subject.assignees) {
  //     // TODO: use URL parser and handle fragment
  //     let role = varRoleMap.get(assignee);
  //     if (role) {
  //       debug('Replace assignee: %s => %s', assignee, role);
  //       assignees.push(role);
  //     } else {
  //       assignees.push(assignee);
  //     }
  //   }
  //   subject.assignees = assignees;
  // }

  // let subjectAssignees: string[] = [];
  // for (let assignee of subject.assignees) {
  //   // TODO: use URL parser and handle fragment
  //   let role = varRoleMap.get(assignee);
  //   if (role) {
  //     debug('Replace assignee: %s => %s', assignee, role);
  //     subjectAssignees.push(role);
  //   } else {
  //     subjectAssignees.push(assignee);
  //   }
  // }
  // subject.assignees = subjectAssignees;


  // If all primary subjects are approved,
  // then the checklist is frozen
  let frozen = true;
  for (let subject of subjects.values()) {
    if (subject.primary) {
      let status = statuses.get(subject.name);
      if (status) {
        frozen = frozen && status.isApproved();
      }
    }
  }

  // If the checklist is frozen AND the subject is NOT final,
  // then updates to the status are not allowed.
  let subject = subjects.get(subjectName);
  if (subject && frozen && !subject.final) {
    throw new RequestError('Not permitted', HttpStatus.FORBIDDEN);
  }

  // If the the subject is NOT mandatory and NOT required,
  // then updates to the status are not allowed.
  if (subject && !subject.mandatory && !subject.required) {
    throw new RequestError('Not permitted', HttpStatus.FORBIDDEN);
  }

  // If the current user does not have a role in the subject assignees,
  // then updates to the status are not allowed.
  if (subject && !auth.hasAnyRole(req, subject.assignees)) {
    throw new RequestError('Not permitted to set status for subject: ${subjectName}', HttpStatus.FORBIDDEN);
  }


  // What about when Subject is YC then AM/DO must also be YC, ADD new data field primary!

  let status = statuses.get(subjectName);

  if (!status) {
    status = new ChecklistStatus({
      value: statusValue,
      comment: statusComment,
      inputAt: new Date(),
      inputBy: username,
    });
  } else {
    status.value = statusValue;
    status.comment = statusComment ? statusComment : '';
    status.inputAt = new Date();
    status.inputBy = username;
  }


  // status.value = newStatusValue;

  // if (status.isApproved(true)) {
  //   status.comment = statusComment;
  // }

  await status.saveWithHistory(status.inputBy);


  res.json(<webapi.Pkg<webapi.ChecklistStatus>> {
    data: {
      
    },
  });

  // let statusMap = new Map<string, ChecklistStatus>();
  // for (let status of statuses) {
  //   statusMap.set(status.subjectName, status);
  // }

  // let prms = new Array<Promise<ChecklistStatus>>();
  // for (let newStatus of <any[]> req.body.data) {
  //   //if (typeof newStatus.subjectId !== 'string') {
  //   //  log.warn('Submitted checklist item data missing _id');
  //   //  continue;
  //   //}
  //   let subject = subjectMap.get(newStatus.subjectId);
  //   let status = statusMap.get(newStatus.subjectId);


  //   if (subject && (subject.mandatory || subject.required)) {
  //     debug('Status submitted name: "%s", value: "%s", comment:"%s"', subject.name, newStatus.value, newStatus.comment);
  //     if (!auth.hasAnyRole(req, [ 'SYS:RUNCHECK' ].concat(subject.assignees))) {
  //       throw new RequestError('Not Permitted', HttpStatus.FORBIDDEN);
  //     }

  //     if (status) {
  //       if (newStatus.value && (newStatus.value !== status.value) && (CHECKLIST_VALUES.includes(newStatus.value))) {
  //         debug('Update status value: %s', newStatus.value);
  //         status.value = newStatus.value;
  //         status.inputOn = new Date();
  //         status.inputBy = username;
  //       }
  //       if ((newStatus.comment !== status.comment) && (typeof newStatus.comment === 'string')) {
  //         debug('Update status comment: %s', newStatus.comment);
  //         status.comment = newStatus.comment;
  //         status.inputOn = new Date();
  //         status.inputBy = username;
  //       }

  //       if (status.isModified()) {
  //         prms.push(status.saveWithHistory(username).catch((err) => {
  //           log.error('Error saving ChecklistStatus: %s', err);
  //           return Promise.reject(err);
  //         }));
  //       }
  //     } else {
  //       debug('Create new checklist status');
  //       debug(newStatus.value !== 'N');
  //       debug(newStatus.value);
  //       debug(CHECKLIST_VALUES);
  //       if (newStatus.value && (newStatus.value !== 'N') && (CHECKLIST_VALUES.includes(newStatus.value))) {
  //         debug('Crete input: value: %s, comment: %s', newStatus.value, newStatus.comment);
  //         status = new ChecklistStatus(<IChecklistStatus> {
  //           subjectName: subject.name,
  //           checklistId: checklist._id,
  //           value: newStatus.value,
  //           comment: newStatus.comment,
  //           inputOn: new Date(),
  //           inputBy: username,
  //         });
  //         prms.push(status.saveWithHistory(username).catch((err) => {
  //           log.error('Error saving ChecklistStatus: %s', err);
  //           return Promise.reject(err);
  //         }));
  //       }
  //     }
  //   }
  // }

  // await Promise.all(prms);

  // let data: webapi.ChecklistStatus[] = [];
  // // for (let status of statuses) {
  // //   if (status.id) {
  // //     //let webUpdate
  // //     let webUpdates: webapi.Update[] = [];

  // //     if (status.history.updates) {
  // //       for (let update of status.history.updates) {
  // //         webUpdates.push({
  // //           at: String(update.at),
  // //           by: update.by,
  // //           paths: update.paths,
  // //         });
  // //       }
  // //     }

  // //     let webStatus = {
  // //       id: status.id,
  // //       checklistId: status.checklistId.toHexString(),
  // //       subjectId: status.subjectId.toHexString(),
  // //       value: status.value,
  // //       comment: status.comment,
  // //       inputBy: status.inputBy,
  // //       inputOn: status.inputOn.toISOString(),
  // //       history: {
  // //         updatedAt: status.history.updatedAt.toISOString(),
  // //         updatedBy: status.history.updatedBy,
  // //         updates: webUpdates,
  // //       },
  // //     };

  // //     data.push(webStatus);
  // //   }
  // // }

  // for (let status of statuses) {
  //   if (status.id) {
  //     //let webUpdate
  //     //let webHistory: webapi.History;
  //     //let webUpdates: webapi.Update[] = [];


  //     //if (status.history) {
  //     let webHistory: webapi.History = {
  //       updates: [],
  //       updatedAt: status.history.updatedAt ? status.history.updatedAt.toISOString() : '',
  //       updatedBy: status.history.updatedBy || '',
  //     };

  //     if ( status.history.updates) {
  //       for (let update of status.history.updates) {
  //         webHistory.updates.push({
  //           at: String(update.at),
  //           by: update.by,
  //           paths: update.paths,
  //         });
  //       }
  //     }

  //     //}

  //     let webStatus = {
  //       id: status.id,
  //       checklistId: status.checklistId.toHexString(),
  //       subjectId: status.subjectName,
  //       value: status.value,
  //       comment: status.comment,
  //       inputBy: status.inputBy,
  //       inputOn: status.inputOn.toISOString(),
  //       history: webHistory,
  //     };

  //     data.push(<any> webStatus);
  //     //webChecklist.statuses.push(webStatus);
  //   }

  // }


  // res.json(<webapi.Pkg<webapi.ChecklistStatus[]>> {
  //   data: data,
  // });
}));

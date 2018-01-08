/**
 * Route handlers for checklists.
 */
import * as dbg  from 'debug';
import * as express from 'express';
import * as lodash from 'lodash';
import * as mongoose from 'mongoose';

import * as auth from '../shared/auth';
//import * as log from '../shared/logging';
import * as models from '../shared/models';

import {
  catchAll,
  ensureAccepts,
  ensurePackage,
  findQueryParam,
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
  IChecklistStatus,
  IChecklistSubject,
} from '../models/checklist';

type ObjectId = mongoose.Types.ObjectId;

interface Target {
  name: string;
  desc: string;
  checklistId?: ObjectId;
};


const debug = dbg('runcheck:checklists');

const CREATED = HttpStatus.CREATED;
const FORBIDDEN = HttpStatus.FORBIDDEN;
const NOT_FOUND = HttpStatus.NOT_FOUND;
const BAD_REQUEST = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

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


/**
 * Map the specified array of objects by checklist type property
 */
function mapByChecklistType<T extends { checklistType?: string }>(p: Promise<T[]>): Promise<Map<string, T[]>> {
  let m = new Map<string, T[]>();
  return p.then((docs) => {
    for (let doc of docs) {
      if (doc.checklistType) {
        let group = m.get(doc.checklistType);
        if (group) {
          group.push(doc);
        } else {
          m.set(doc.checklistType, [ doc ]);
        }
      }
    }
    return m;
  });
}

/**
 * Map the specified array of objects by checklist ID property
 */
function mapByChecklistId<T extends { checklistId?: ObjectId }>(p: Promise<T[]>): Promise<Map<string, T[]>> {
  let m = new Map<string, T[]>();
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
      }
    }
    return m;
  });
}

function applyCfg(subject: webapi.ChecklistSubject, cfg?: ChecklistConfig) {
  if (cfg) {
    // if (typeof cfg.name === 'string') {
    //   subject.name = cfg.name;
    // }
    if (Array.isArray(cfg.assignees) && (cfg.assignees.length > 0)) {
      subject.assignees = Array.from(cfg.assignees);
    }
    if (typeof cfg.required === 'boolean') {
      subject.required = cfg.required;
    }
    // HISTORY!!!
  }
}

// function newSubject(sub: ChecklistSubject, cfg?: ChecklistConfig): webapi.ChecklistSubject {
//   let subject: webapi.ChecklistSubject = {
//     //id: '', //String(subject.id),
//     name: sub.name,
//     desc: sub.desc,
//     //checklistId: '', // subject.checklistId ? subject.checklistId.toHexString() : String(checklist.id),
//     //checklistType: subject.checklistType,
//     order: sub.order,
//     assignees: sub.assignees,
//     final: sub.final,
//     primary: sub.primary,
//     required: sub.required,
//     mandatory: sub.mandatory,
//   };
//   if (cfg) {
//     if (typeof cfg.name === 'string') {
//       subject.name = cfg.name;
//     }
//     if (Array.isArray(cfg.assignees) && (cfg.assignees.length > 0)) {
//       subject.assignees = Array.from(cfg.assignees);
//     }
//     if (typeof cfg.required === 'boolean') {
//       subject.required = cfg.required;
//     }
//     // if (cfg.history.updatedAt) {
//     //   if (!this.history.updatedAt || cfg.history.updatedAt > this.history.updatedAt) {
//     //     this.history.updatedAt = cfg.history.updatedAt;
//     //     this.history.updatedBy = cfg.history.updatedBy;
//     //   }
//     // }
//     // if (cfg.history && Array.isArray(cfg.history.updateIds)) {
//     //   if (this.history && Array.isArray(this.history.updateIds)) {
//     //     this.history.updateIds = this.history.updateIds.concat(cfg.history.updateIds);
//     //   } else {
//     //     this.history.updateIds = Array.from(cfg.history.updateIds);
//     //   }
//     // }
//     // if (Array.isArray(cfg.history.updates)) {
//     //   if (Array.isArray(this.history.updates)) {
//     //     this.history.updates = this.history.updates.concat(cfg.history.updates);
//     //   } else {
//     //     this.history.updates = Array.from(cfg.history.updates);
//     //   }
//     // }
//   }
//   return subject;
// }

/**
 * Get the variable roles based on object type
 */
export function getVarRoles(obj: { dept?: string, area?: string, owner?: string, memberType?: string }): Map<string, string> {
  let varRoles = new Map<string, string>();
  if (obj.dept) {
    varRoles.set(auth.formatRole('VAR', 'DEPT_LEADER'), auth.formatRole('GRP', obj.dept, 'LEADER'));
  }
  if (obj.area) {
    varRoles.set(auth.formatRole('VAR', 'AREA_LEADER'), auth.formatRole('GRP', obj.area, 'LEADER'));
  }
  if (obj.owner) {
    if (obj.memberType === Slot.modelName) {
      varRoles.set(auth.formatRole('VAR', 'AREA_LEADER'), auth.formatRole('GRP', obj.owner, 'LEADER'));
    }
    if (obj.memberType === Device.modelName) {
      varRoles.set(auth.formatRole('VAR', 'DEPT_LEADER'), auth.formatRole('GRP', obj.owner, 'LEADER'));
    }
  }
  return varRoles;
}

function subVarRoles(roles: string[], varRoles: Map<string, string>): string[] {
  let newRoles: string[] = [];
  for (let role of roles) {
    let varRole = varRoles.get(role);
    if (varRole) {
      newRoles.push(varRole);
    } else {
      newRoles.push(role);
    }
  }
  return newRoles;
};


export const router = express.Router();


router.get('/', catchAll(async (req, res) => {
  let targetType = findQueryParam(req, 'type');
  debug('Checklist target type: %s', targetType);

  return format(res, {
    'text/html': () => {
      res.render('checklists', {
        targetType: targetType,
      });
    },
    'application/json': async () => {
      let targets: Target[];
      let checklistVarRoles = new Map<string, Map<string, string>>();

      switch (targetType ? targetType.toUpperCase() : undefined) {
      case 'SLOT': {
        debug('Find Slots with assigned checklist (that are not group members)');
        let slots = await Slot.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec();
        for (let slot of slots) {
          if (slot.checklistId) {
            checklistVarRoles.set(slot.checklistId.toHexString(), getVarRoles(slot));
          }
        }
        targets = slots;
        break;
      }
      case 'DEVICE': {
        debug('Find Devices with assigned checklist');
        let devices = await Device.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec();
        for (let device of devices) {
          if (device.checklistId) {
            checklistVarRoles.set(device.checklistId.toHexString(), getVarRoles(device));
          }
        }
        targets = devices;
        break;
      }
      case 'SLOTGROUP': {
        debug('Find Groups of Slots with assigned checklist');
        let groups = await Group.find({ checklistId: { $exists: true }, memberType: Slot.modelName }).exec();
        for (let group of groups) {
          if (group.checklistId) {
            checklistVarRoles.set(group.checklistId.toHexString(), getVarRoles(group));
          }
        }
        targets = groups;
        break;
      }
      default: {
        debug('Find Slots, Devices and Groups with assigned checklist');
        let [ slots, devices, groups ] = await Promise.all([
          Slot.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec(),
          Device.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec(),
          Group.find({ checklistId: { $exists: true } }).exec(),
        ]);
        targets = [];
        for (let slot of slots) {
          if (slot.checklistId) {
            targets.push(slot);
            checklistVarRoles.set(slot.checklistId.toHexString(), getVarRoles(slot));
          }
        }
        for (let device of devices) {
          if (device.checklistId) {
            targets.push(device);
            checklistVarRoles.set(device.checklistId.toHexString(), getVarRoles(device));
          }
        }
        for (let group of groups) {
          if (group.checklistId) {
            targets.push(group);
            checklistVarRoles.set(group.checklistId.toHexString(), getVarRoles(group));
          }
        }
        break;
      }}

      let checklistIds: ObjectId[] = [];
      for (let target of targets) {
        if (target.checklistId) {
          checklistIds.push(target.checklistId);
        }
      }

      let [ checklists, checklistSubjects, checklistConfigs, checklistStatuses ] = await Promise.all([
        models.mapById(Checklist.find({ _id: { $in: checklistIds } }).exec()),
        mapByChecklistType(ChecklistSubject.find({
          $or: [ {checklistId: { $exists: false }}, {checklistId: { $in: checklistIds }} ],
        }).exec()),
        mapByChecklistId(ChecklistConfig.find({ checklistId: { $in: checklistIds } }).exec()),
        mapByChecklistId(ChecklistStatus.find({ checklistId: { $in: checklistIds } }).exec()),
      ]);

      debug('Found Checklists: %s', checklists.size);

      let apiChecklists: webapi.ChecklistTableRow[] = [];
      for (let target of targets) {
        if (!target.checklistId) {
          continue;
        }

        let checklistId = target.checklistId.toHexString();

        let checklist = checklists.get(checklistId);
        if (!checklist || !checklist.id) {
          continue;
        }

        let subjects = checklistSubjects.get(checklist.checklistType);
        if (!subjects) {
          continue;
        }

        let configs = checklistConfigs.get(checklistId);
        if (!configs) {
          configs = [];
        }

        let statuses = checklistStatuses.get(checklistId);
        if (!statuses) {
          statuses = [];
        }

        let varRoles = checklistVarRoles.get(checklistId);
        if (!varRoles) {
          varRoles = new Map<string, string>();
        }

        let canUpdate = new Map<string, boolean>();
        let webSubjects: webapi.ChecklistSubject[] = [];
        for (let subject of subjects) {
          if (!subject.checklistId || subject.checklistId.equals(checklist._id)) {

            let webSubject: webapi.ChecklistSubject = {
              name: subject.name,
              desc: subject.desc,
              order: subject.order,
              assignees: subject.assignees,
              final: subject.final,
              primary: subject.primary,
              required: subject.required,
              mandatory: subject.mandatory,
            };

            for (let config of configs) {
              if (config.subjectName === subject.name) {
                applyCfg(webSubject, config);
                break;
              }
            }

            webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
            canUpdate.set(subject.name, auth.hasAnyRole(req, webSubject.assignees));

            webSubjects.push(webSubject);
          }
        }

        let webStatuses: webapi.ChecklistStatusTableRow[] = [];
        for (let status of statuses) {
          webStatuses.push({
            subjectName: status.subjectName,
            value: status.value,
            comment: status.comment,
            inputBy: status.inputBy,
            inputAt: status.inputAt.toISOString(),
            canUpdate: Boolean(canUpdate.get(status.subjectName)),
          });
        }

        apiChecklists.push({
          id: checklist.id,
          targetId: checklist.targetId.toHexString(),
          targetType: checklist.targetType,
          targetName: target.name,
          targetDesc: target.desc,
          checklistType: checklist.checklistType,
          subjects: webSubjects,
          statuses: webStatuses,
        });
      }

      res.json(<webapi.Pkg<webapi.Checklist[]>> {
        data: apiChecklists,
      });
    },
  });
}));


/**
 * Create a new checklsit for the specified target.
 */
// router.post('/', ensureAccepts('json'), ensureAuthenticated, catchAll(async () => {
//
// });

/**
 * Get checklist details for the checklist with the specified ID.
 */
router.get('/:id', ensureAccepts('json'), catchAll(async (req, res) => {
  const id = String(req.params.id);
  debug('Find Checklist with id: %s', id);

  let checklist = await Checklist.findById(id);
  if (!checklist || !checklist.id) {
    throw new RequestError('Checklist not found', NOT_FOUND);
  }

  // Defer these results until they are needed later.
  let pending = Promise.all([
    ChecklistSubject.findWithHistory({
      checklistType: checklist.checklistType,
      $or: [{checklistId: {$exists: false}}, {checklistId: checklist._id}],
    }),
    ChecklistConfig.findWithHistory({ checklistId : checklist._id }),
    ChecklistStatus.findWithHistory({ checklistId : checklist._id }),
  ]);

  let varRoles: Map<string, string>;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(device);
    break;
  }
  case Slot.modelName: {
    let slot = await Slot.findById(checklist.targetId).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(slot);
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(group);
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs, statuses ] = await pending;
  debug('Found Checklist subjects: %s, configs: %s, statuses: %s', subjects.length, configs.length, statuses.length);

  let canUpdate = new Map<string, boolean>();
  let webSubjects: webapi.ChecklistSubject[] = [];
  for (let subject of subjects) {

    let webSubject = {
      order: subject.order,
      name: subject.name,
      desc: subject.desc,
      assignees: subject.assignees,
      final: subject.final,
      primary: subject.primary,
      required: subject.required,
      mandatory: subject.mandatory,
    };

    for (let config of configs) {
      if (config.subjectName === subject.name) {
        applyCfg(webSubject, config);
        break;
      }
    }

    subject.assignees = subVarRoles(subject.assignees, varRoles);

    canUpdate.set(subject.name, auth.hasAnyRole(req, subject.assignees));

    webSubjects.push(webSubject);
  }

  let webStatuses: webapi.ChecklistStatusDetails[] = [];
  for (let status of statuses) {
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

    let webStatus: webapi.ChecklistStatusDetails = {
      subjectName: status.subjectName,
      value: status.value,
      comment: status.comment,
      inputBy: status.inputBy,
      inputAt: status.inputAt.toISOString(),
      canUpdate: Boolean(canUpdate.get(status.subjectName)),
      history: webHistory,
    };

    webStatuses.push(webStatus);
  }

  const webChecklist: webapi.ChecklistDetails = {
    id: String(checklist.id),
    targetId: checklist.targetId.toHexString(),
    targetType: checklist.targetType,
    checklistType: checklist.checklistType,
    // editable: auth.hasAnyRole(req, [ 'SYS:RUNCHECK', ownerRole ]),
    canEdit: false,
    subjects: webSubjects,
    statuses: webStatuses,
  };

  res.json(<webapi.Pkg<webapi.Checklist>> {
    data: webChecklist,
  });
}));


/**
 * Create a new (custom) checklist subject.
 */
router.post('/:id/subjects', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let id = String(req.params.id);
  debug('Find Checklist with id: %s', id);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request', INTERNAL_SERVER_ERROR);
  }

  let checklist = await Checklist.findById(id).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', NOT_FOUND);
  }

  let ownerRole: string;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', device.dept, 'LEADER');
    break;
  }
  case Slot.modelName: {
    let slot = await Slot.findById(checklist.targetId).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', slot.area, 'LEADER');
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', group.owner, 'LEADER');
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  if (!auth.hasAnyRole(req, ownerRole)) {
    throw new RequestError('Not permitted to create subject', FORBIDDEN);
  }

  let pkg: webapi.Pkg<{ desc?: {}, assignees?: {} }> = req.body;

  if (typeof pkg.data.desc !== 'string' || pkg.data.desc === '') {
    throw new RequestError('Subject description is required', BAD_REQUEST);
  }
  let desc = String(pkg.data.desc);

  if (!Array.isArray(pkg.data.assignees)) {
    throw new RequestError('Subject assignees are required', BAD_REQUEST);
  }
  let assignees: string[] = [];
  for (let assignee of pkg.data.assignees) {
    if (typeof assignee !== 'string' || assignee === '') {
      throw new RequestError(`Subject assignee is invalid: ${assignee}`, BAD_REQUEST);
    }
    let role = auth.parseRole(assignee);
    if (!role) {
      throw new RequestError(`Subject assignee is invalid: ${assignee}`, BAD_REQUEST);
    }
    assignees.push(auth.formatRole(role));
  }

  let doc: IChecklistSubject = {
    name: `C${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
    desc: desc,
    order: 0,
    final: false,
    primary: false,
    required: true,
    mandatory: true,
    assignees: assignees,
    checklistType: checklist.checklistType,
  };
  let subject = new ChecklistSubject(doc);

  await subject.saveWithHistory(username);

  let webSubject: webapi.ChecklistSubjectDetails = {
    name: subject.name,
    desc: subject.desc,
    order: subject.order,
    final: subject.final,
    primary: subject.primary,
    required: subject.required,
    mandatory: subject.mandatory,
    assignees: subject.assignees,
  };

  res.status(CREATED).json(<webapi.Pkg<webapi.ChecklistSubjectDetails>> {
    data: webSubject,
  });
}));

/**
 * Update a checklist subject specified by name
 */
// tslint:disable-next-line:max-line-length
router.put('/:id/subjects/:name', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let id = String(req.params.id).toUpperCase();
  let name = String(req.params.name).toUpperCase();
  debug('Find Checklist with id: %s', id);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request.', INTERNAL_SERVER_ERROR);
  }

  let checklist = await Checklist.findById(id).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', NOT_FOUND);
  }

  let pending = Promise.all([
    ChecklistSubject.find({
      checklistType: checklist.checklistType,
      $or: [ {checklistId: {$exists: false}}, {checklistId: checklist._id} ],
    }).exec(),
    ChecklistConfig.find({
      checklistId: checklist._id,
    }).exec(),
  ]);

  let ownerRole: string;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', device.dept, 'LEADER');
    break;
  }
  case Slot.modelName: {
    let slot = await Slot.findById(checklist.targetId).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', slot.area, 'LEADER');
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    ownerRole = auth.formatRole('GRP', group.owner, 'LEADER');
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs ] = await pending;

  let subject: IChecklistSubject | undefined;
  for (let s of subjects) {
    if (s.name === name) {
      subject = s;
      break;
    }
  }
  if (!subject) {
    throw new RequestError(`Checklist subject not found`, NOT_FOUND);
  }

  let config: ChecklistConfig | undefined;
  for (let c of configs) {
    if (c.subjectName === name) {
      config = c;
      break;
    }
  }

  if (!auth.hasAnyRole(req, ownerRole)) {
    throw new RequestError('Not permitted to modify subject', FORBIDDEN);
  }

  let pkg: webapi.Pkg<{ required?: {}, assignees?: {} }> = req.body;

  if (pkg.data.required !== undefined) {
    if (typeof pkg.data.required !== 'boolean') {
      throw new RequestError('Subject required is invalid', BAD_REQUEST);
    }
    let required = pkg.data.required;
    if (config) {
      if (config.required !== required) {
        config.required = required;
      }
    } else if (subject.required !== required) {
      if (subject.mandatory) {
        throw new RequestError('Subject is not editable', BAD_REQUEST);
      }
      config = new ChecklistConfig(<IChecklistConfig> {
        required: required,
        subjectName: subject.name,
        checklistId: checklist._id,
      });
    }
  }

  if (pkg.data.assignees !== undefined) {
    if (!Array.isArray(pkg.data.assignees)) {
      throw new RequestError('Subject assignees are invalid', BAD_REQUEST);
    }

    let assignees: string[] = [];
    for (let assignee of pkg.data.assignees) {
      if (typeof assignee !== 'string' || assignee === '') {
        throw new RequestError(`Subject assignee is invalid: ${assignee}`, BAD_REQUEST);
      }
      let role = auth.parseRole(assignee);
      if (!role) {
        throw new RequestError(`Subject assignee is invalid: ${assignee}`, BAD_REQUEST);
      }
      assignees.push(auth.formatRole(role));
    }
    if (config) {
      if (!lodash.isEqual(config.assignees, assignees)) {
        config.assignees = assignees;
      }
    } else if (!lodash.isEqual(subject.assignees, assignees)) {
      if (subject.mandatory) {
        throw new RequestError('Subject is not editable', BAD_REQUEST);
      }
      config = new ChecklistConfig(<IChecklistConfig> {
        assignees: assignees,
        subjectName: subject.name,
        checklistId: checklist._id,
      });
    }
  }

  if (config && config.isModified()) {
    debug('Save subject configuration: %s', config.subjectName);
    await config.saveWithHistory(username);
  }

  let webSubject: webapi.ChecklistSubjectDetails = {
    name: subject.name,
    desc: subject.desc,
    order: subject.order,
    final: subject.final,
    primary: subject.primary,
    required: subject.required,
    mandatory: subject.mandatory,
    assignees: subject.assignees,
  };

  if (config) {
    debug('Apply config to subject: %s', subject.name);
    applyCfg(webSubject, config);
  }

  res.json(<webapi.Pkg<webapi.ChecklistSubjectDetails>> {
    data: webSubject,
  });

  //let required = Boolean(pkg.data.required);

  // let varRoleMap = new Map<string, string>();

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



  // if (checklist.targetType === Device.modelName) {
  //   let device = await Device.findById(checklist.targetId).exec();
  //   if (!device || !device.id) {
  //     throw new RequestError('Device not found', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  //   varRoleMap.set('VAR:DEPT_LEADER', 'GRP:' + device.dept + '#LEADER');
  // } else {
  //   throw new RequestError('Target type not supported: ' + checklist.targetType);
  // }

  // let cfgMap = new Map<string, ChecklistConfig>();
  // for (let config of configs) {
  //   //if (config.subjectId) {
  //   cfgMap.set(config.subjectName, config);
  //   //}
  // }

  // let subjectMap = new Map<string, ChecklistSubject>();
  // for (let subject of subjects) {
  //   if (subject.id) {
  //     subjectMap.set(subject.name, subject);
  //   }
  // }

  // let newItemSet = new Set<string>();
  // let itemPms = new Array<Promise<ChecklistSubject>>();
  // let cfgPms = new Array<Promise<ChecklistConfig>>();
  // for (let newSubject of <webapi.ChecklistSubject[]> req.body.data) {
  //   if (typeof newSubject.name !== 'string') {
  //     log.warn('Submitted checklist item missing _id');
  //     continue;
  //   }
  //   newItemSet.add(newSubject.name);

  //   let subject = subjectMap.get(newSubject.name);
  //   let cfg = cfgMap.get(newSubject.name);
  //   if (subject) {
  //     itemPms.push(Promise.resolve(new ChecklistSubject(subject)));
  //     debug('Update ChecklistItem (%s) with subject: %s', subject._id, subject.name);
  //   } else {
  //     subject = new ChecklistSubject(<IChecklistSubject> {
  //       //_id: models.generateId(),
  //       checklistType: checklist.checklistType,
  //       checklistId: models.ObjectId(checklist._id),
  //       name: 'SUBJECT',
  //     });

  //     subject._id = models.generateId();

  //     if (typeof newSubject.name === 'string') {
  //       subject.name = newSubject.name;
  //     }

  //     debug('Add new ChecklistItem (%s) with subject: %s', subject.id, subject.name);

  //     // let opts = {
  //     //   userid: username,
  //     //   desc: 'Add checklist item',
  //     // };

  //     itemPms.push(subject.saveWithHistory(username).catch((err) => {
  //       log.error('Error saving new ChecklistItem: ' + err);
  //       return Promise.reject(err);
  //     }));
  //   }

  //   if (isCustom(subject)) {
  //     if (typeof newSubject.name === 'string') {
  //       if (cfg && (typeof cfg.name === 'string')) {
  //         if (cfg.name !== newSubject.name) {
  //           if (subject.name !== newSubject.name) {
  //             cfg.name = newSubject.name;
  //           } else {
  //             cfg.name = undefined; // fallback to subject
  //           }
  //         }
  //       } else {
  //         if (subject.name !== newSubject.name) {
  //           if (!cfg) {
  //             cfg = new ChecklistConfig(<IChecklistConfig> {
  //               subjectName: subject.name,
  //               checklistType: checklist.checklistType,
  //               checklistId: models.ObjectId(checklist._id),
  //             });
  //           }
  //           cfg.name = newSubject.name;
  //         }
  //       }
  //     } else {
  //       log.error('warn: ChecklistSubject property, "name", expecting type String');
  //     }
  //   }

  //   if (!subject.mandatory) {
  //     if (typeof newSubject.required === 'boolean') {
  //       if (cfg && (typeof cfg.required === 'boolean')) {
  //         if (cfg.required !== newSubject.required) {
  //           if (subject.required !== newSubject.required) {
  //             cfg.required = newSubject.required;
  //           } else {
  //             cfg.required = undefined; // defer to item
  //           }
  //         }
  //       } else {
  //         if (subject.required !== newSubject.required) {
  //           if (!cfg) {
  //             cfg = new ChecklistConfig(<IChecklistConfig> {
  //               subjectName: subject.name,
  //               checklistType: checklist.checklistType,
  //               checklistId: models.ObjectId(checklist._id),
  //             });
  //           }
  //           cfg.required = newSubject.required;
  //         }
  //       }
  //     } else {
  //       log.error('warn: ChecklistItem property, "required", expecting type Boolean');
  //     }
  //   }

  //   // if (typeof newSubject.assignee === 'string') {
  //   //   if (cfg && (typeof cfg.assignee === 'string')) {
  //   //     if (cfg.assignee !== newSubject.assignee) {
  //   //       if (item.assignee !== newSubject.assignee) {
  //   //         cfg.assignee = newSubject.assignee;
  //   //       } else {
  //   //         cfg.assignee = undefined; // defer to item
  //   //       }
  //   //     }
  //   //   } else {
  //   //     if (item.assignee !== newItem.assignee) {
  //   //       if (!cfg) {
  //   //         cfg = new ChecklistItemCfg({
  //   //           item: item._id,
  //   //           type: checklist.type,
  //   //           checklist: checklist._id,
  //   //         });
  //   //       }
  //   //       cfg.assignee = newSubject.assignee;
  //   //     }
  //   //   }
  //   // } else {
  //   //   log.error('warn: ChecklistItem property, "assignee", expecting String');
  //   // }

  //   if (cfg) {
  //     if (cfg.isModified()) {
  //       debug('save ChecklistItemCfg: %s', cfg._id);
  //       // let opts = {
  //       //   userid: req.session.userid,
  //       //   desc: 'Update checklist item',
  //       // };
  //       cfgPms.push(cfg.saveWithHistory(username).catch((err) => {
  //         log.error('warn: Error saving ChecklistItemCfg (%s): %s', cfg ? cfg._id : 'undefined', err);
  //         return Promise.reject(err);
  //       }));
  //     } else {
  //       cfgPms.push(Promise.resolve(cfg));
  //     }
  //   }
  // }

  // let rmItemPms = new Array<Promise<ChecklistSubject>>();
  // for (let subject of subjects) {
  //   if (isCustom(subject) && !newItemSet.has(subject._id)) {
  //     rmItemPms.push(subject.remove().catch((err) => {
  //       log.error('warn: Error removing ChecklistItem (%s):', subject.id, err);
  //       return Promise.reject(err);
  //     }));
  //     debug('Remove ChecklistItem: %s', subject.id);
  //   }
  // }

  // await Promise.all([checklist, Promise.all(itemPms), Promise.all(cfgPms), Promise.all(rmItemPms)]);

  // res.status(200).json({});
}));

/**
 * Update subject status for the given checklist and subject.
 */
// tslint:disable-next-line:max-line-length
router.put('/:id/statuses/:name', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let id = String(req.params.id);
  let name = String(req.params.name).toUpperCase();
  debug('Find Checklist with id: %s', id);

  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request.', INTERNAL_SERVER_ERROR);
  }

  let checklist = await Checklist.findById(id).exec();
  if (!checklist) {
    throw new RequestError('Checklist not found', NOT_FOUND);
  }

  let pending = Promise.all([
    ChecklistSubject.find({
      checklistType: checklist.checklistType,
      $or: [ {checklistId: {$exists: false}}, {checklistId: checklist._id} ],
    }).exec(),
    ChecklistConfig.find({
      checklistId: checklist._id,
    }).exec(),
    ChecklistStatus.findWithHistory({
      checklistId: checklist._id,
    }),
  ]);

  let varRoles: Map<string, string>;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(device);
    break;
  }
  case Slot.modelName: {
    let slot = await Slot.findById(checklist.targetId).exec();
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(slot);
    if (slot.installDeviceId) {
      let device = await Device.findById(slot.installDeviceId).exec();
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      let varRoles2 = getVarRoles(device);
      for (let entry of varRoles2.entries()) {
        varRoles.set(entry[0], entry[1]);
      }
    }
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = getVarRoles(group);
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs, statuses ] = await pending;

  // Need to track 'basic' (ie non-primary, non-final) subjects 
  let basic: string[] = [];

  let subject: IChecklistSubject | undefined;
  for (let s of subjects) {
    if (s.name === name) {
      subject = s;
    }
    if ((s.mandatory || s.required) && !s.primary && !s.final) {
      basic.push(s.name);
    }
  }
  if (!subject) {
    throw new RequestError(`Checklist subject not found`, NOT_FOUND);
  }

  let config: ChecklistConfig | undefined;
  for (let c of configs) {
    if (c.subjectName === name) {
      config = c;
      break;
    }
  }
  if (config) {
    debug('Apply config to subject: %s', subject.name);
    applyCfg(<webapi.ChecklistSubject> subject, config);
  }

  let forceYC = false;
  let status: ChecklistStatus | undefined
  for (let s of statuses) {
    if (s.subjectName === name) {
      status = s;
    }
    if (basic.includes(s.subjectName)) {
      forceYC = forceYC || (s.value === 'YC');
    }
  }

  subject.assignees = subVarRoles(subject.assignees, varRoles);

  if (!auth.hasAnyRole(req, subject.assignees)) {
    throw new RequestError('Not permitted to modify subject', FORBIDDEN);
  }

  let pkg = <webapi.Pkg<{ value?: {}, comment?: {} }>> req.body;

  if (!subject.mandatory && !subject.required) {
    throw new RequestError('Checklsit status is not required', BAD_REQUEST);
  }

  let value = pkg.data.value ? String(pkg.data.value).trim().toUpperCase() : undefined;
  debug('Checklist Status value: %s', value);
  if (!value) {
    throw new RequestError(`Checklist status value required`, BAD_REQUEST);
  }
  if (!CHECKLIST_VALUES.includes(value)) {
    throw new RequestError(`Checklist status value invalid: ${value}`, BAD_REQUEST);
  }
  if (forceYC && (value !== 'YC')) {
    throw new RequestError(`Checklist status value must be YC`, BAD_REQUEST);
  }

  let comment = pkg.data.comment ? String(pkg.data.comment).trim() : '';
  debug('Checklist status comment: "%s"', comment);
  if (value !== 'YC') {
    comment = ''; // Comment is cleared if the value is not YC!
  } else if (comment === '') {
    throw new RequestError(`Checklist status comment is required`, BAD_REQUEST);
  }

  if (status) {
    if (status.value !== value) {
      status.value = value;
    }
    if (status.comment !== comment) {
      status.comment = comment;
    }
  } else {
    status = new ChecklistStatus(<IChecklistStatus> {
      value: value,
      comment: comment,
      subjectName: name,
      checklistId: checklist._id,
    });
  }

  if (status.isModified()) {
    status.inputBy = username;
    status.inputAt = new Date();
    await status.saveWithHistory(username);
  }

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

  let webStatus: webapi.ChecklistStatusDetails = {
    subjectName: status.subjectName,
    value: status.value,
    comment: status.comment,
    inputBy: status.inputBy,
    inputAt: status.inputAt.toISOString(),
    canUpdate: true,
    history: webHistory,
  };

  res.json(<webapi.Pkg<webapi.ChecklistStatusDetails>> {
    data: webStatus,
  });

  // if (!Array.isArray(req.body.data)) {
  //   throw new RequestError('Invalid request data', HttpStatus.UNPROCESSABLE_ENTITY);
  // }

  // debug('Find checklist by ID: %s', checklistId);
  // let checklist = await Checklist.findById(checklistId).exec();
  // if (!checklist) {
  //   throw new RequestError('Checklist not found', NOT_FOUND);
  // }

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

  // let deferredSlot: Promise<Slot | null> = Promise.resolve(null);
  // let deferredGroup: Promise<Group | null> = Promise.resolve(null);
  // let deferredDevice: Promise<Device | null> = Promise.resolve(null);

  // switch (checklist.targetType) {
  // case Slot.modelName:
  //   debug('Find slot with ID: %s', checklist.targetId);
  //   deferredSlot = Slot.findById(checklist.targetId).exec();
  //   break;
  // case Group.modelName:
  //   debug('Find group with ID: %s', checklist.targetId);
  //   deferredGroup = Group.findById(checklist.targetId).exec();
  //   break;
  // case Device.modelName:
  //   debug('Find device with ID: %s', checklist.targetId);
  //   deferredDevice = Device.findById(checklist.targetId).exec();
  //   break;
  // default:
  //   throw new RequestError(`Checklist target type invalid: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  // }

  // let [ subjects, configs, statuses, device, slot, group ] = await Promise.all([
  //   models.mapById(ChecklistSubject.find({
  //     $or: [{
  //       checklistType: checklist.checklistType,
  //       checklistId: { $exists: false }, // TODO: exists(false)
  //       name: subjectName,
  //     }, {
  //       checklistType: checklist.checklistType,
  //       checklistId: { $in: [null, checklist._id] }, // TODO: exists(false)
  //       name: subjectName,
  //     }],
  //   }).exec()),
  //   models.mapByPath('subjectName', ChecklistConfig.find({
  //     checklistId: checklist._id,
  //     subjectName: subjectName,
  //   }).exec()),
  //   models.mapByPath('subjectName', ChecklistStatus.find({
  //     checklistId: checklist._id,
  //     subjectName: subjectName,
  //   }).exec()),
  //   deferredDevice, deferredSlot, deferredGroup,
  // ]);

  // if (!subjects.has(subjectName)) {
  //   throw new RequestError('Checklist subject not found', NOT_FOUND);
  // }

  // let varRoleMap = new Map<string, string>();

  // switch (checklist.targetType) {
  // case Slot.modelName:
  //   if (slot) {
  //     //debug('')
  //     //let role = auth.formatRole('GRP', slot.area, 'LEADER');
  //     //debug('')
  //     varRoleMap.set('AREA_LEADER', auth.formatRole('GRP', slot.area, 'LEADER'));
  //   } else {
  //     throw new RequestError('Slot not found', NOT_FOUND);
  //   }
    
  //   break;
  // case Device.modelName:
  //   if (!device) {
  //     throw new RequestError('Device not found', NOT_FOUND);
  //   }
  //   varRoleMap.set('DEPT_LEADER', auth.formatRole('GRP', device.dept, 'LEADER'));
  //   break;
  // case Group.modelName:
  //   if (!group) {
  //     throw new RequestError('Group not found', NOT_FOUND);
  //   }
  //   switch (group.memberType) {
  //   case Slot.modelName:
  //     varRoleMap.set('AREA_LEADER', auth.formatRole('GRP', 'TODO', 'LEADER'));
  //     break;
  //   case Device.modelName:
  //     varRoleMap.set('DEPT_LEADER', auth.formatRole('GRP', 'TODO', 'LEADER'));
  //     break;
  //   default:
  //     throw new RequestError(`Group member type invalid: ${group.memberType}`, INTERNAL_SERVER_ERROR);
  //   }
  //   break;
  // default:
  //   throw new RequestError(`Checklist target type invalid: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  // }

  // // TODO: Common function
  // for (let subject of subjects.values()) {
  //   let config = configs.get(subject.name);
  //   if (config) {
  //     subject.applyCfg(config);
  //   }
  //   let assignees: string[] = [];
  //   for (let assignee of subject.assignees) {
  //     let role = auth.parseRole(assignee);
  //     if (!role) {
  //       // RequestError('Assignee role is malformed', INTERNAL_SERVER_ERROR);
  //       // LOG!
  //       continue;
  //     }
  //     if (role.scheme !== 'VAR') {
  //       assignees.push(auth.formatRole(role));
  //       continue;
  //     }
  //     let varRole = varRoleMap.get(role.identifier);
  //     if (!varRole) {
  //       // LOG throw new RequestError('Variable role is undefined', INTERNAL_SERVER_ERROR);
  //       continue
  //     }
  //     assignees.push(varRole);
  //   }
  //   subject.assignees = assignees;
  // }

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


  // // If all primary subjects are approved,
  // // then the checklist is frozen
  // let frozen = true;
  // for (let subject of subjects.values()) {
  //   if (subject.primary) {
  //     let status = statuses.get(subject.name);
  //     if (status) {
  //       frozen = frozen && status.isApproved();
  //     }
  //   }
  // }

  // // If the checklist is frozen AND the subject is NOT final,
  // // then updates to the status are not allowed.
  // let subject = subjects.get(subjectName);
  // if (subject && frozen && !subject.final) {
  //   throw new RequestError('Not permitted', HttpStatus.FORBIDDEN);
  // }

  // // If the the subject is NOT mandatory and NOT required,
  // // then updates to the status are not allowed.
  // if (subject && !subject.mandatory && !subject.required) {
  //   throw new RequestError('Not permitted', HttpStatus.FORBIDDEN);
  // }

  // // If the current user does not have a role in the subject assignees,
  // // then updates to the status are not allowed.
  // if (subject && !auth.hasAnyRole(req, subject.assignees)) {
  //   throw new RequestError('Not permitted to set status for subject: ${subjectName}', HttpStatus.FORBIDDEN);
  // }


  // What about when Subject is YC then AM/DO must also be YC, ADD new data field primary!

  // let status = statuses.get(subjectName);

  // if (!status) {
  //   status = new ChecklistStatus({
  //     value: statusValue,
  //     comment: statusComment,
  //     inputAt: new Date(),
  //     inputBy: username,
  //   });
  // } else {
  //   status.value = statusValue;
  //   status.comment = statusComment ? statusComment : '';
  //   status.inputAt = new Date();
  //   status.inputBy = username;
  // }


  // status.value = newStatusValue;

  // if (status.isApproved(true)) {
  //   status.comment = statusComment;
  // }

  // await status.saveWithHistory(status.inputBy);


  // res.json(<webapi.Pkg<webapi.ChecklistStatus>> {
  //   data: {
      
  //   },
  // });

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

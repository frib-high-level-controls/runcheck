/**
 * Route handlers for checklists.
 */
import * as dbg  from 'debug';
import * as express from 'express';
import * as lodash from 'lodash';
import * as mongoose from 'mongoose';

import * as auth from '../shared/auth';
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
  SafetyLevel,
  Slot,
} from '../models/slot';

import {
  Group,
} from '../models/group';

import {
  Checklist,
  ChecklistConfig,
  ChecklistStatus,
  ChecklistSubject,
  ChecklistType,
  IChecklist,
  IChecklistConfig,
  IChecklistStatus,
  IChecklistSubject,
  isChecklistApproved,
  isChecklistValueApproved,
  isChecklistValueValid,
} from '../models/checklist';

type ObjectId = mongoose.Types.ObjectId;

interface Target {
  name: string;
  desc: string;
  dept?: string;
  area?: string;
  owner?: string;
  memberType?: string;
  checklistId?: ObjectId;
};

interface RouterOptions {
  adminRoles?: string[];
}

const debug = dbg('runcheck:checklists');

const CREATED = HttpStatus.CREATED;
const CONFLICT = HttpStatus.CONFLICT;
const FORBIDDEN = HttpStatus.FORBIDDEN;
const NOT_FOUND = HttpStatus.NOT_FOUND;
const BAD_REQUEST = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;


let adminRoles: string[] = [];

export function getAdminRoles(): string[] {
  return Array.from(adminRoles);
}

export function setAdminRoles(roles: string[]) {
  adminRoles = Array.from(roles);
}


const router = express.Router();

export function getRouter(opts?: RouterOptions): express.Router {
  if (opts) {
    if (opts.adminRoles) {
      setAdminRoles(opts.adminRoles);
    }
  }
  return router;
};


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

/**
 * Get the checklist type for a slot (or slot group)
 */
export function getSlotChecklistType(safetyLevel?: SafetyLevel): ChecklistType {
  switch (safetyLevel) {
  case SafetyLevel.NONE:
  case SafetyLevel.CONTROL:
  case SafetyLevel.CREDITED:
  default:
    return ChecklistType.SLOT_DEFAULT;
  case SafetyLevel.CONTROL_ESH:
  case SafetyLevel.CREDITED_ESH:
  case SafetyLevel.CREDITED_PPS:
    return ChecklistType.SLOT_SAFETY;
  }
}

/**
 * Get the checklist type for a device
 */
export function getDeviceChecklistType(): ChecklistType {
  return ChecklistType.DEVICE_DEFAULT;
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
    // TODO: HISTORY!!!
  }
}


/**
 * Get the variable roles based on target type
 */
function getVarRoles(target: Target): [string, string] {
  if (target.dept) {
    return ['DEPT_LEADER', auth.formatRole('GRP', target.dept, 'LEADER')];
  }
  if (target.area) {
    return ['AREA_LEADER', auth.formatRole('GRP', target.area, 'LEADER')];
  }
  if (target.owner) {
    if (target.memberType === Slot.modelName) {
      return ['AREA_LEADER', auth.formatRole('GRP', target.owner, 'LEADER')];
    }
    if (target.memberType === Device.modelName) {
      return ['DEPT_LEADER', auth.formatRole('GRP', target.owner, 'LEADER')];
    }
  }
  return ['', ''];
}

/**
 * Substitute any 'VAR' roles in the list of roles with those in the array.
 */
function subVarRoles(roles: string[], varRoles: Array<[string, string]>): string[] {
  let varRolesMap = new Map<string, string>(varRoles);
  let subRoles = new Array<string>();
  for (let role of roles) {
    let r = auth.parseRole(role);
    if (r && r.scheme === 'VAR') {
      let varRole = varRolesMap.get(r.identifier);
      if (varRole) {
        subRoles.push(varRole);
      }
    } else {
      subRoles.push(role);
    }
  }
  return subRoles;
};


/**
 * Get list of checklists for either SLOT, DEVICE, SLOTGROUP or everything.
 */
router.get('/checklists', catchAll(async (req, res) => {
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
      let checklistVarRoles = new Map<string, Array<[string, string]>>();

      switch (targetType ? targetType.toUpperCase() : undefined) {
      case 'SLOT': {
        debug('Find Slots with assigned checklist (that are not group members)');
        let [ slots, groups ] = await Promise.all([
          Slot.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec(),
          Group.find({ checklistId: { $exists: true }, memberType: Slot.modelName }).exec(),
        ]);
        targets = [];
        for (let slot of slots) {
          if (slot.checklistId) { // needed for type checking only, query ensures it exists!
            targets.push(slot);
            checklistVarRoles.set(slot.checklistId.toHexString(), [ getVarRoles(slot) ]);
          }
        }
        for (let group of groups) {
          if (group.checklistId) { // needed for type checking only, query ensures it exists!
            targets.push(group);
            checklistVarRoles.set(group.checklistId.toHexString(), [ getVarRoles(group) ]);
          }
        }
        break;
      }
      case 'DEVICE': {
        debug('Find Devices with assigned checklist');
        let devices = await Device.find({ checklistId: { $exists: true }, groupId: { $exists: false }}).exec();
        for (let device of devices) {
          if (device.checklistId) { // needed for type checking only, query ensures it exists!
            checklistVarRoles.set(device.checklistId.toHexString(), [ getVarRoles(device) ]);
          }
        }
        targets = devices;
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
          if (slot.checklistId) { // needed for type checking only, query ensures it exists!
            targets.push(slot);
            checklistVarRoles.set(slot.checklistId.toHexString(), [ getVarRoles(slot) ]);
          }
        }
        for (let device of devices) {
          if (device.checklistId) { // needed for type checking only, query ensures it exists!
            targets.push(device);
            checklistVarRoles.set(device.checklistId.toHexString(), [ getVarRoles(device) ]);
          }
        }
        for (let group of groups) {
          if (group.checklistId) { // needed for type checking only, query ensures it exists!
            targets.push(group);
            checklistVarRoles.set(group.checklistId.toHexString(), [ getVarRoles(group) ]);
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

      let webChecklists: webapi.ChecklistTableRow[] = [];
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
          varRoles = [];
        }

        let webSubjects: webapi.ChecklistSubjectTableRow[] = [];
        for (let subject of subjects) {
          if (!subject.checklistId || subject.checklistId.equals(checklist._id)) {

            let webSubject: webapi.ChecklistSubjectTableRow = {
              name: subject.name,
              desc: subject.desc,
              order: subject.order,
              assignees: subject.assignees,
              final: subject.final,
              primary: subject.primary,
              required: subject.required,
              mandatory: subject.mandatory,
              canUpdate: false, // restricted by default
            };

            for (let config of configs) {
              if (config.subjectName === subject.name) {
                applyCfg(webSubject, config);
                break;
              }
            }

            webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
            webSubject.canUpdate = auth.hasAnyRole(req, adminRoles, webSubject.assignees);

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
          });
        }

        webChecklists.push({
          id: checklist.id,
          targetId: checklist.targetId.toHexString(),
          targetType: checklist.targetType,
          targetName: target.name,
          targetDesc: target.desc,
          checklistType: checklist.checklistType,
          subjects: webSubjects,
          statuses: webStatuses,
          approved: checklist.approved,
          checked: checklist.checked,
          total: checklist.total,
        });
      }

      res.json(<webapi.Pkg<webapi.ChecklistTableRow[]>> {
        data: webChecklists,
      });
    },
  });
}));


/**
 * Create a new checklist for the specified target.
 */
// tslint:disable-next-line:max-line-length
router.post('/checklists', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let username = auth.getUsername(req);
  if (!username) {
    throw new RequestError('No username on authenticated request', INTERNAL_SERVER_ERROR);
  }

  let pkg: webapi.Pkg<{ targetId?: {}, targetType?: {} }> = req.body;

  let targetId = pkg.data.targetId ? String(pkg.data.targetId) : undefined;
  debug('New Checklist targetId: %s', targetId);
  if (!targetId) {
    throw new RequestError('Checklist target ID is required', BAD_REQUEST);
  }

  let targetType = pkg.data.targetType ? String(pkg.data.targetType).toUpperCase() : undefined;
  debug('New Checklist targetType: %s', targetType);
  if (!targetType) {
    throw new RequestError('Checklist target type is required', BAD_REQUEST);
  }

  let slot: Slot | null = null;
  let device: Device | null = null;
  let group: Group | null = null;

  let varRoles: Array<[string, string]>;
  let ownerRole: string | undefined;
  let checklistId: ObjectId | undefined;
  let checklistType: ChecklistType | undefined;

  switch (targetType) {
  case Slot.modelName.toUpperCase(): {
    debug('Find slot with id: %s', targetId);
    [ slot, device ] = await Promise.all([
      Slot.findById(targetId).exec(),
      Device.findOne({ installSlotId: targetId }).exec(),
    ]);
    if (!slot || !slot.id) {
      throw new RequestError('Checklist target (slot) not found', BAD_REQUEST);
    }
    varRoles = [ getVarRoles(slot) ];
    ownerRole = varRoles[0][1];
    if (slot.installDeviceId) {
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      varRoles.push(getVarRoles(device));
    }
    targetId = String(slot.id);
    targetType = Slot.modelName;
    checklistId = slot.checklistId;
    checklistType = getSlotChecklistType(slot.safetyLevel);
    device = null; // Clear the device since target type is Slot
    break;
  }
  case Device.modelName.toUpperCase(): {
    debug('Find device with id: %s', targetId);
    device = await Device.findById(targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Checklist target (device) not found', BAD_REQUEST);
    }
    targetId = String(device.id);
    targetType = Device.modelName;
    checklistType = getDeviceChecklistType();
    checklistId = device.checklistId;
    varRoles = [ getVarRoles(device) ];
    ownerRole = varRoles[0][1];
    break;
  }
  case Group.modelName.toUpperCase(): {
    debug('Find group with id: %s', targetId);
    group = await Group.findById(targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Checklist target (group) not found', BAD_REQUEST);
    }
    targetId = String(group.id);
    targetType = Group.modelName;
    checklistId = group.checklistId;
    switch (group.memberType) {
    case Slot.modelName:
      checklistType = getSlotChecklistType(group.safetyLevel);
      break;
    case Device.modelName:
      checklistType = getDeviceChecklistType();
      break;
    default:
      throw new RequestError(`Group member type '${group.memberType}' not supported`, INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(group) ];
    ownerRole = varRoles[0][1];
    break;
  }
  default:
    throw new RequestError('Checklist target type is invalid', BAD_REQUEST);
  }

  debug('Assert user has any role: %s', ownerRole);
  if (!auth.hasAnyRole(req, adminRoles, ownerRole)) {
    throw new RequestError('Not permitted to assign checklist', FORBIDDEN);
  }

  if (slot && !slot.installDeviceId) {
    throw new RequestError('Slot must have device installed', BAD_REQUEST);
  }

  if (checklistId) {
    throw new RequestError('Target already assigned checklist', CONFLICT);
  }

  let subjects = await ChecklistSubject.find({
    checklistType: checklistType,
    checklistId: {$exists: false},
  }).exec();

  const doc: IChecklist = {
    checklistType: checklistType,
    targetType: targetType,
    targetId: models.ObjectId(targetId),
    approved: false,
    checked: 0,
    total: 0,
  };

  debug('Create new Checklist with type: %s', doc.checklistType);
  const checklist = new Checklist(doc);

  debug('Save checklist with updated summary');
  isChecklistApproved(checklist, subjects, [], [], true);
  await checklist.save();

  if (slot) {
    debug('Update target (slot) with new checklist id: %s', checklist._id);
    slot.checklistId = models.ObjectId(checklist._id);
    await slot.saveWithHistory(auth.formatRole('USR', username));
  }
  if (device) {
    debug('Update target (device) with new checklist id: %s', checklist._id);
    device.checklistId = models.ObjectId(checklist._id);
    await device.saveWithHistory(auth.formatRole('USR', username));
  }
  if (group) {
    debug('Update target (group) with new checklist id: %s', checklist._id);
    group.checklistId = models.ObjectId(checklist._id);
    await group.saveWithHistory(auth.formatRole('USR', username));
  }

  let webSubjects: webapi.ChecklistSubjectDetails[] = [];
  for (let subject of subjects) {
    let webSubject: webapi.ChecklistSubjectDetails = {
      name: subject.name,
      desc: subject.desc,
      order: subject.order,
      final: subject.final,
      primary: subject.primary,
      required: subject.required,
      mandatory: subject.mandatory,
      assignees: subject.assignees,
      canUpdate: false, // restricted by default
    };

    webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
    webSubject.canUpdate =  auth.hasAnyRole(req, adminRoles, webSubject.assignees);

    webSubjects.push(webSubject);
  }

  let webChecklist: webapi.ChecklistDetails = {
    id: String(checklist.id),
    targetId: targetId,
    targetType: targetType,
    checklistType: checklist.checklistType,
    // If user can assign checklist,
    // then they can edit checklist.
    canEdit: true,
    subjects: webSubjects,
    statuses: [],
    approved: checklist.approved,
    checked: checklist.checked,
    total: checklist.total,
  };

  res.status(CREATED).json(<webapi.Pkg<webapi.ChecklistDetails>> {
    data: webChecklist,
  });
}));

/**
 * Get checklist details for the checklist with the specified ID.
 */
router.get('/checklists/:id', ensureAccepts('json'), catchAll(async (req, res) => {
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

  let varRoles: Array<[string, string]>;
  let ownerRole: string | undefined;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(device) ];
    ownerRole = varRoles[0][1];
    break;
  }
  case Slot.modelName: {
    let [ slot, device ] = await Promise.all([
      Slot.findById(checklist.targetId).exec(),
      Device.findOne({ installSlotId: checklist.targetId }).exec(),
    ]);
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(slot) ];
    ownerRole = varRoles[0][1];
    if (slot.installDeviceId) {
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      varRoles.push(getVarRoles(device));
    }
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(group) ];
    ownerRole = varRoles[0][1];
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs, statuses ] = await pending;
  debug('Found Checklist subjects: %s, configs: %s, statuses: %s', subjects.length, configs.length, statuses.length);

  let webSubjects: webapi.ChecklistSubjectDetails[] = [];
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
      canUpdate: false, // restricted by default
    };

    for (let config of configs) {
      if (config.subjectName === subject.name) {
        applyCfg(webSubject, config);
        break;
      }
    }

    webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
    webSubject.canUpdate =  auth.hasAnyRole(req, adminRoles, webSubject.assignees);

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
      history: webHistory,
    };

    webStatuses.push(webStatus);
  }

  const webChecklist: webapi.ChecklistDetails = {
    id: String(checklist.id),
    targetId: checklist.targetId.toHexString(),
    targetType: checklist.targetType,
    checklistType: checklist.checklistType,
    canEdit: auth.hasAnyRole(req, adminRoles, ownerRole),
    subjects: webSubjects,
    statuses: webStatuses,
    approved: checklist.approved,
    checked: checklist.checked,
    total: checklist.total,
  };

  res.json(<webapi.Pkg<webapi.Checklist>> {
    data: webChecklist,
  });
}));


/**
 * Create a new (custom) checklist subject.
 */
// tslint:disable-next-line:max-line-length
router.post('/checklists/:id/subjects', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
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

  let pending = Promise.all([
    ChecklistSubject.find({
      checklistType: checklist.checklistType,
      $or: [ {checklistId: {$exists: false}}, {checklistId: checklist._id} ],
    }).exec(),
    ChecklistConfig.find({
      checklistId: checklist._id,
    }).exec(),
    ChecklistStatus.find({
      checklistId: checklist._id,
    }).exec(),
  ]);

  let varRoles: Array<[string, string]>;
  let ownerRole: string;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(device) ];
    ownerRole = varRoles[0][1];
    break;
  }
  case Slot.modelName: {
    let [ slot, device ] = await Promise.all([
      Slot.findById(checklist.targetId).exec(),
      Device.findOne({ installSlotId: checklist.targetId }).exec(),
    ]);
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(slot) ];
    ownerRole = varRoles[0][1];
    if (slot.installDeviceId) {
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      varRoles.push(getVarRoles(device));
    }
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(group) ];
    ownerRole = varRoles[0][1];
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  if (!auth.hasAnyRole(req, adminRoles, ownerRole)) {
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

  let [ subjects, configs, statuses] = await pending;
  debug('Found Checklist subjects: %s, configs: %s, statuses: %s', subjects.length, configs.length, statuses.length);

  let doc: IChecklistSubject = {
    name: `C${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
    desc: desc,
    order: 0,
    final: false,
    primary: false,
    required: true,
    mandatory: true,
    assignees: assignees,
    checklistId: models.ObjectId(checklist._id),
    checklistType: checklist.checklistType,
  };
  let subject = new ChecklistSubject(doc);

  await subject.saveWithHistory(auth.formatRole('USR', username));

  subjects.push(subject);

  debug('Save checklist with updated summary');
  isChecklistApproved(checklist, subjects, configs, statuses, true);
  await checklist.save();

  let webSubject: webapi.ChecklistSubjectDetails = {
    name: subject.name,
    desc: subject.desc,
    order: subject.order,
    final: subject.final,
    primary: subject.primary,
    required: subject.required,
    mandatory: subject.mandatory,
    assignees: subject.assignees,
    canUpdate: false, // restricted by default
  };

  webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
  webSubject.canUpdate =  auth.hasAnyRole(req, adminRoles, webSubject.assignees);

  res.status(CREATED).json(<webapi.Pkg<webapi.ChecklistSubjectDetails>> {
    data: webSubject,
  });
}));

/**
 * Update a checklist subject specified by name
 */
// tslint:disable-next-line:max-line-length
router.put('/checklists/:id/subjects/:name', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
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
    ChecklistStatus.find({
      checklistId: checklist._id,
    }).exec(),
  ]);

  let varRoles: Array<[string, string]>;
  let ownerRole: string;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(device) ];
    ownerRole = varRoles[0][1];
    break;
  }
  case Slot.modelName: {
    let [ slot, device ] = await Promise.all([
      Slot.findById(checklist.targetId).exec(),
      Device.findOne({ installSlotId: checklist.targetId }).exec(),
    ]);
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(slot) ];
    ownerRole = varRoles[0][1];
    if (slot.installDeviceId) {
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      varRoles.push(getVarRoles(device));
    }
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(group) ];
    ownerRole = varRoles[0][1];
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs, statuses ] = await pending;
  debug('Found Checklist subjects: %s, configs: %s, statuses: %s', subjects.length, configs.length, statuses.length);

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

  if (!auth.hasAnyRole(req, adminRoles, ownerRole)) {
    throw new RequestError('Not permitted to modify subject', FORBIDDEN);
  }

  let pkg: webapi.Pkg<{ required?: {}, assignees?: {} }> = req.body;

  if (pkg.data.required !== undefined) {
    if (typeof pkg.data.required !== 'boolean') {
      throw new RequestError('Checklist Subject required is invalid', BAD_REQUEST);
    }
    let required = pkg.data.required;
    if (config) {
      if (config.required !== required) {
        config.required = required;
      }
    } else if (subject.required !== required) {
      if (subject.mandatory) {
        throw new RequestError('Checklist subject is mandatory', BAD_REQUEST);
      }
      config = new ChecklistConfig(<IChecklistConfig> {
        required: required,
        subjectName: subject.name,
        checklistId: checklist._id,
      });
      configs.push(config);
    }
  }

  if (pkg.data.assignees !== undefined) {
    if (!Array.isArray(pkg.data.assignees)) {
      throw new RequestError('Checklist subject assignees are invalid', BAD_REQUEST);
    }

    let assignees: string[] = [];
    for (let assignee of pkg.data.assignees) {
      if (typeof assignee !== 'string' || assignee === '') {
        throw new RequestError(`Checklist subject assignee is empty`, BAD_REQUEST);
      }
      let role = auth.parseRole(assignee);
      if (!role) {
        throw new RequestError(`Checklist subject assignee is invalid: ${assignee}`, BAD_REQUEST);
      }
      assignees.push(auth.formatRole(role));
    }
    if (config) {
      if (!lodash.isEqual(config.assignees, assignees)) {
        config.assignees = assignees;
      }
    } else if (!lodash.isEqual(subject.assignees, assignees)) {
      if (subject.primary) {
        throw new RequestError('Checklist subject assignees are not editable', BAD_REQUEST);
      }
      config = new ChecklistConfig(<IChecklistConfig> {
        assignees: assignees,
        subjectName: subject.name,
        checklistId: checklist._id,
      });
      configs.push(config);
    }
  }

  if (config) {
    debug('Save subject configuration: %s', config.subjectName);
    await config.saveWithHistory(auth.formatRole('USR', username));
  }

  debug('Save checklist with updated summary');
  isChecklistApproved(checklist, subjects, configs, statuses, true);
  await checklist.save();

  let webSubject: webapi.ChecklistSubjectDetails = {
    name: subject.name,
    desc: subject.desc,
    order: subject.order,
    final: subject.final,
    primary: subject.primary,
    required: subject.required,
    mandatory: subject.mandatory,
    assignees: subject.assignees,
    canUpdate: false, // restricted by default
  };

  if (config) {
    debug('Apply config to subject: %s', subject.name);
    applyCfg(webSubject, config);
  }

  webSubject.assignees = subVarRoles(webSubject.assignees, varRoles);
  webSubject.canUpdate = auth.hasAnyRole(req, adminRoles, webSubject.assignees);

  res.json(<webapi.Pkg<webapi.ChecklistSubjectDetails>> {
    data: webSubject,
  });

}));

/**
 * Update subject status for the given checklist and subject.
 */
// tslint:disable-next-line:max-line-length
router.put('/checklists/:id/statuses/:name', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
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

  let varRoles: Array<[string, string]>;

  switch (checklist.targetType) {
  case Device.modelName: {
    let device = await Device.findById(checklist.targetId).exec();
    if (!device || !device.id) {
      throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(device) ];
    break;
  }
  case Slot.modelName: {
    let [ slot, device ] = await Promise.all([
      Slot.findById(checklist.targetId).exec(),
      Device.findOne({ installSlotId: checklist.targetId }).exec(),
    ]);
    if (!slot || !slot.id) {
      throw new RequestError('Slot not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(slot) ];
    if (slot.installDeviceId) {
      if (!device) {
        throw new RequestError('Device not found', INTERNAL_SERVER_ERROR);
      }
      varRoles.push(getVarRoles(device));
    }
    break;
  }
  case Group.modelName: {
    let group = await Group.findById(checklist.targetId).exec();
    if (!group || !group.id) {
      throw new RequestError('Group not found', INTERNAL_SERVER_ERROR);
    }
    varRoles = [ getVarRoles(group) ];
    break;
  }
  default:
    throw new RequestError(`Target type not supported: ${checklist.targetType}`, INTERNAL_SERVER_ERROR);
  }

  let [subjects, configs, statuses ] = await pending;

  // Need to track 'basic' (ie non-primary, non-final) subjects
  let basic: string[] = [];
  let primary: string[] = [];

  let subject: IChecklistSubject | undefined;
  for (let s of subjects) {
    if (s.name === name) {
      subject = s;
    }
    if ((s.mandatory || s.required) && !s.primary && !s.final) {
      basic.push(s.name);
    }
    if (s.primary) {
      primary.push(s.name);
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

  let basicComment = false;
  let primaryApproved: boolean | undefined;
  let status: ChecklistStatus | undefined;
  for (let s of statuses) {
    if (s.subjectName === name) {
      status = s;
    }
    if (basic.includes(s.subjectName)) {
      basicComment = basicComment || isChecklistValueApproved(s.value, true);
    }
    if (primary.includes(s.subjectName)) {
      if (primaryApproved === undefined) {
        primaryApproved = true;
      }
      primaryApproved = primaryApproved && isChecklistValueApproved(s.value);
    }
  }

  subject.assignees = subVarRoles(subject.assignees, varRoles);

  debug('Assert user has any role: [%s]', subject.assignees);
  if (!auth.hasAnyRole(req, adminRoles, subject.assignees)) {
    throw new RequestError('Not permitted to modify subject', FORBIDDEN);
  }

  let pkg = <webapi.Pkg<{ value?: {}, comment?: {} }>> req.body;

  // If primary subject(s) is approved than basic subjects are locked.
  if (primaryApproved && basic.includes(subject.name)) {
    throw new RequestError('Checklist status is locked', BAD_REQUEST);
  }

  // Non-mandatory and non-required subjects can not be updated.
  if (!subject.mandatory && !subject.required) {
    throw new RequestError('Checklist status is not required', BAD_REQUEST);
  }

  let value = pkg.data.value ? String(pkg.data.value).trim().toUpperCase() : undefined;
  debug('Checklist Status value: %s', value);
  if (!value) {
    throw new RequestError(`Checklist status value required`, BAD_REQUEST);
  }
  if (!isChecklistValueValid(value)) {
    throw new RequestError(`Checklist status value invalid: ${value}`, BAD_REQUEST);
  }
  // If a basic subject is approved with comment than primary subject requires a comment.
  if (basicComment && primary.includes(subject.name)
      && isChecklistValueApproved(value) && !isChecklistValueApproved(value, true)) {
    throw new RequestError(`Checklist status requires a comment`, BAD_REQUEST);
  }

  let comment = pkg.data.comment ? String(pkg.data.comment).trim() : '';
  debug('Checklist status comment: "%s"', comment);
  if (!isChecklistValueApproved(value, true)) {
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
    status.inputBy = username;
    status.inputAt = new Date();

  } else {
    let doc: IChecklistStatus = {
      value: value,
      comment: comment,
      subjectName: name,
      checklistId: checklist._id,
      inputBy: username,
      inputAt: new Date(),
    };
    status = new ChecklistStatus(doc);
    statuses.push(status);
  }

  if (status.isModified()) {
    // A checklist can only become approved or unapproved
    // through a change in status. To ensure failsafe
    // operation the checklist approval is revoked before
    // a change in status and then (possibly) re-approved
    // after the change in status is completed successful.
    // If a failure occurs during this process the
    // checklist will fail in the more safe unapproved state.
    if (checklist.approved) {
      debug('Save checklist with approval revoked (failsafe)');
      checklist.approved = false;
      await checklist.save();
    }
    debug('Save checklist status with history');
    await status.saveWithHistory(auth.formatRole('USR', username));

    debug('Save checklist with updated summary');
    isChecklistApproved(checklist, subjects, configs, statuses, true);
    await checklist.save();
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
        at: update.at.toISOString(),
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
    history: webHistory,
  };

  res.json(<webapi.Pkg<webapi.ChecklistStatusDetails>> {
    data: webStatus,
  });

}));

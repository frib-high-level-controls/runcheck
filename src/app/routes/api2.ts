/**
 * RESTful API for RunCheck v2
 */
import * as dbg from 'debug';
import * as express from 'express';

import {
  isValidId,
  mapById,
  matchPattern,
  ObjectId,
} from '../shared/models';

import {
  catchAll,
  ensureAccepts,
  findQueryParam,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import {
  resolveChecklist,
} from '../lib/checklists';

import {
  Checklist,
} from '../models/checklist';

import {
  Device,
} from '../models/device';

import {
  Slot,
} from '../models/slot';

import {
  Group,
} from '../models/group';

interface API2Slot {
  id: string;
  name: string;
  desc: string;
  area: string;
  deviceType: string;
  approved: boolean;
  careLevel: string;
  safetyLevel: string;
  arr: string;
  drr: string;
  machineModes: string[];
}

interface API2SlotConds {
  name?: RegExp | { $in: RegExp[] };
  area?: RegExp | { $in: RegExp[] };
  deviceType?: RegExp | { $in: RegExp[] };
  arr?: RegExp | { $in: RegExp[] };
  drr?: RegExp | { $in: RegExp[] };
  careLevel?: string | { $in: string[] };
  safetyLevel?: string | { $in: string[] };
  machineModes?: RegExp | { $in: RegExp[] };
}

interface API2Device {
  id: string;
  name: string;
  desc: string;
  dept: string;
  deviceType: string;
  approved: boolean;
}

interface API2DeviceConds {
  name?: RegExp | { $in: RegExp[] };
  dept?: RegExp | { $in: RegExp[] };
  deviceType?: RegExp | { $in: RegExp[] };
}

const debug = dbg('runcheck:routes:api2');

const NOT_FOUND = HttpStatus.NOT_FOUND;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

const router = express.Router();

export function getRouter(opts?: {}): express.Router {
  return router;
}

// Methods for preparing mongo conditions from request query parameters

function qpString(v: any): string {
  return (v ? String(v) : '');
}

function qpExists(req: express.Request, name: string): [string | string[], boolean] {
  let v = findQueryParam(req, name, false, true);
  const found = (v || v === '' || v === 0.0 || Array.isArray(v));
  if (!found) {
    return ['', false];
  }
  if (Array.isArray(v)) {
    v = v.map((s) => qpString(s));
  } else {
    v = qpString(v);
  }
  return [v, true];
}

function upperCaseCond(value: string | string[]): string | { $in: string[] } {
  if (Array.isArray(value)) {
    const query: { $in: string[] } = { $in: [] };
    for (const v of value) {
      query.$in.push(v.toUpperCase());
    }
    return query;
  }
  return value.toUpperCase();
}

function patternCond(value: string | string[], flags?: string): RegExp | { $in: RegExp[] } {
  if (Array.isArray(value)) {
    const query: { $in: RegExp[] } = { $in: [] };
    for (const v of value) {
      query.$in.push(matchPattern(v, flags));
    }
    return query;
  }
  return matchPattern(value, flags);
}


router.get('/api/v2/slots', ensureAccepts('json'), catchAll(async (req, res) => {
  const conds: API2SlotConds = {};

  let [value, exists] = qpExists(req, 'name');
  if (exists) {
    conds.name = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'area');
  if (exists) {
    conds.area = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'deviceType');
  if (exists) {
    conds.deviceType = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'arr');
  if (exists) {
    conds.arr = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'drr');
  if (exists) {
    conds.drr = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'careLevel');
  if (exists) {
    conds.careLevel = upperCaseCond(value);
  }

  [value, exists] = qpExists(req, 'safetyLevel');
  if (exists) {
    conds.safetyLevel = upperCaseCond(value);
  }

  [value, exists] = qpExists(req, 'machineMode');
  if (exists) {
    conds.machineModes = patternCond(value, 'i');
  }

  // Support for paging may be need?
  // let limit: undefined | number;
  // [value, exists] = qpExists(req, 'limit');
  // if (exists) {
  //   if (Array.isArray(value)) {
  //     if (value.length > 0) {
  //       limit = Number(value[0]);
  //     }
  //   } else {
  //     limit = Number(value);
  //   }
  //   if (limit) {
  //     limit = Number.isFinite(limit) ? limit : undefined;
  //   }
  // }
  //
  // let start: undefined | number;
  // [value, exists] = qpExists(req, 'start');
  // if (exists) {
  //   if (Array.isArray(value)) {
  //     if (value.length > 0) {
  //       start = Number(value[0]);
  //     }
  //   } else {
  //     start = Number(value);
  //   }
  //   if (start) {
  //     limit = Number.isFinite(start) ? start : undefined;
  //   }
  // }

  if (debug.enabled) {
    debug('Find slots: Conds: %s, Limit: %s, Start: %s', JSON.stringify(conds));
  }

  const [ slots, groups, checklists ] = await Promise.all([
    Slot.find(conds).sort({ name: -1 }).exec(),
    mapById(Group.find({ memberType: Slot.modelName }).exec()),
    mapById(Checklist.find({ targetType: { $in: [ Slot.modelName, Group.modelName ] }}).exec()),
  ]);

  const api2Slots = new Array<API2Slot>();
  for (const slot of slots) {
    let approved = false;
    try {
     const checklist = resolveChecklist(slot, checklists, groups);
     if (checklist) {
       approved = checklist.approved;
     }
    } catch (err) {
      throw new RequestError(`Checklist not resolved: ${err.message}`, INTERNAL_SERVER_ERROR);
    }

    api2Slots.push({
      id: ObjectId(slot._id).toHexString(),
      name: slot.name,
      desc: slot.desc,
      area: slot.area,
      deviceType: slot.deviceType,
      arr: slot.arr,
      drr: slot.drr,
      careLevel: slot.careLevel,
      safetyLevel: slot.safetyLevel,
      machineModes: slot.machineModes,
      approved: approved,
    });
  }
  res.json(api2Slots);
}));


router.get('/api/v2/slots/:name_or_id', ensureAccepts('json'), catchAll( async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Slot (and checklist) with name or id: %s', nameOrId);

  let slot: Slot | null = null;
  let checklist: Checklist | null = null;
  if (isValidId(nameOrId)) {
    [ slot, checklist ] = await Promise.all([
      Slot.findById(nameOrId).exec(),
      Checklist.findOne({ targetId: nameOrId }).exec(),
    ]);
  } else {
    slot = await Slot.findOne({ name: nameOrId.toUpperCase() }).exec();
    if (slot && slot.checklistId) {
      checklist = await Checklist.findOne({ targetId: slot.checklistId }).exec();
    }
  }

  if (!slot) {
    throw new RequestError('Slot not found', NOT_FOUND);
  }

  if (slot.checklistId && !(checklist && slot.checklistId.equals(checklist._id))) {
    throw new RequestError('Expected Checklist not found', INTERNAL_SERVER_ERROR);
  }

  const approved = checklist ? checklist.approved : false;

  const api2Slot: API2Slot = {
    id: ObjectId(slot._id).toHexString(),
    name: slot.name,
    desc: slot.desc,
    area: slot.area,
    deviceType: slot.deviceType,
    drr: slot.drr,
    arr: slot.arr,
    careLevel: slot.careLevel,
    safetyLevel: slot.safetyLevel,
    machineModes: slot.machineModes,
    approved: approved,
  };
  res.json(api2Slot);
}));


router.get('/api/v2/devices', ensureAccepts('json'), catchAll(async (req, res) => {
  const conds: API2DeviceConds = {};

  let [value, exists] = qpExists(req, 'name');
  if (exists) {
    conds.name = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'dept');
  if (exists) {
    conds.dept = patternCond(value, 'i');
  }

  [value, exists] = qpExists(req, 'deviceType');
  if (exists) {
    conds.deviceType = patternCond(value, 'i');
  }
  if (debug.enabled) {
    debug('Find devices: Conds: %s, Limit: %s, Start: %s', JSON.stringify(conds));
  }

  const [ devices, groups, checklists ] = await Promise.all([
    Device.find(conds).sort({ name: -1 }).exec(),
    mapById(Group.find({ memberType: Device.modelName }).exec()),
    mapById(Checklist.find({ targetType: { $in: [ Device.modelName, Group.modelName ] }}).exec()),
  ]);

  const api2Devices = new Array<API2Device>();
  for (const device of devices) {
    let approved = false;
    try {
     const checklist = resolveChecklist(device, checklists, groups);
     if (checklist) {
       approved = checklist.approved;
     }
    } catch (err) {
      throw new RequestError(`Checklist not resolved: ${err.message}`, INTERNAL_SERVER_ERROR);
    }

    api2Devices.push({
      id: ObjectId(device._id).toHexString(),
      name: device.name,
      desc: device.desc,
      dept: device.dept,
      deviceType: device.deviceType,
      approved: approved,
    });
  }
  res.json(api2Devices);
}));


router.get('/api/v2/devices/:name_or_id', ensureAccepts('json'), catchAll( async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Device (and checklist) with name or id: %s', nameOrId);

  let device: Device | null = null;
  let checklist: Checklist | null = null;
  if (isValidId(nameOrId)) {
    [ device, checklist ] = await Promise.all([
      Device.findById(nameOrId).exec(),
      Checklist.findOne({ targetId: nameOrId }).exec(),
    ]);
  } else {
    device = await Device.findOne({ name: nameOrId.toUpperCase() }).exec();
    if (device && device.checklistId) {
      checklist = await Checklist.findOne({ targetId: device.checklistId }).exec();
    }
  }

  if (!device) {
    throw new RequestError('Device not found', NOT_FOUND);
  }

  if (device.checklistId && !(checklist && device.checklistId.equals(checklist._id))) {
    throw new RequestError('Expected Checklist not found', INTERNAL_SERVER_ERROR);
  }

  const approved = checklist ? checklist.approved : false;

  const api2Device: API2Device = {
    id: ObjectId(device._id).toHexString(),
    name: device.name,
    desc: device.desc,
    dept: device.dept,
    deviceType: device.deviceType,
    approved: approved,
  };
  res.json(api2Device);
}));

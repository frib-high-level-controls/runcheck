/**
 * RESTful API for RunCheck v2
 */
import * as util from 'util';

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

type Request = express.Request;
type Response = express.Response;

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
const BAD_REQUEST = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

const router = express.Router();

export function getRouter(opts?: {}): express.Router {
  return router;
}

// Methods for preparing mongo conditions from request query parameters

/**
 * Consolidate request parameters (from query and body) into single map (case insensitive)
 */
function ReqParamsToMap(req: Request): Map<string, string | string[]> {
  const m = new Map<string, string | string[]>();

  function str(v: {}) {
    return (v ? String(v) : '');
  }

  function append(key: string, value: {}) {
    const k = key.toUpperCase();

    let v: string | string[];
    if (Array.isArray(value)) {
      v = value.map(str);
    } else {
      v = str(value);
    }

    const cv = m.get(k);
    if (cv) {
      if (Array.isArray(cv)) {
        m.set(k, cv.concat(v));
      } else {
        m.set(k, [ cv ].concat(v));
      }
    } else {
      m.set(k, v);
    }
  }

  for (const key of Object.keys(req.query)) {
    append(key, req.query[key]);
  }

  if (req.body) {
    for (const key of Object.keys(req.body)) {
      append(key, req.body[key]);
    }
  }

  return m;
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


async function slotFilterHandler(req: Request, res: Response) {
  const params = ReqParamsToMap(req);

  let start: number | undefined;
  let limit: number | undefined;
  const conds: API2SlotConds = {};
  for (const [key, value] of  params.entries()) {
    switch (key) {
      case 'NAME':
        conds.name = patternCond(value, 'i');
        continue;
      case 'AREA':
        conds.area = patternCond(value, 'i');
        continue;
      case 'DEVICETYPE':
        conds.deviceType = patternCond(value, 'i');
        continue;
      case 'ARR':
        conds.arr = patternCond(value, 'i');
        continue;
      case 'DRR':
        conds.drr = patternCond(value, 'i');
        continue;
      case 'CARELEVEL':
        conds.careLevel = upperCaseCond(value);
        continue;
      case 'SAFETYLEVEL':
        conds.safetyLevel = upperCaseCond(value);
        continue;
      case 'MACHINEMODE':
        conds.machineModes = patternCond(value, 'i');
        continue;

      // pagination
      case 'START':
        start = Number(value);
        if (!Number.isInteger(start) || start < 0) {
          throw new RequestError(`Start parameter is invalid: ${value}`, BAD_REQUEST);
        }
        continue;
      case 'LIMIT':
        limit = Number(value);
        if (!Number.isInteger(limit) || limit < 0) {
          throw new RequestError(`Limit parameter is invalid: ${value}`, BAD_REQUEST);
        }
        continue;

      default:
        throw new RequestError(`Filter parameter unsupported: ${key}`, BAD_REQUEST);
    }
  }

  if (debug.enabled) {
    debug('Find slots: Conds: %s, Start: %s, Limit: %s', util.inspect(conds), start, limit);
  }

  const [ slots, groups, checklists ] = await Promise.all([
    Slot.find(conds).sort({ name: 1 }).skip(start || 0).limit(limit || 10000).exec(),
    mapById(Group.find({ memberType: Slot.modelName }).exec()),
    mapById(Checklist.find({ targetType: { $in: [ Slot.modelName, Group.modelName ] }}).exec()),
  ]);

  const pkg: webapi.Pkg<API2Slot[]> = { data: [] };
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

    pkg.data.push({
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
  res.json(pkg);
}

router.get('/api/v2/slots(;filter)?', ensureAccepts('json'), catchAll(slotFilterHandler));

router.post('/api/v2/slots;filter', ensureAccepts('json'), catchAll(slotFilterHandler));


router.get('/api/v2/slots/:name_or_id', ensureAccepts('json'), catchAll(async (req, res) => {
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
    throw new RequestError('Expected checklist not found', INTERNAL_SERVER_ERROR);
  }

  const approved = checklist ? checklist.approved : false;

  const pkg: webapi.Pkg<API2Slot> = {
    data: {
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
    },
  };
  res.json(pkg);
}));


async function deviceFilterHandler(req: Request, res: Response) {
  const params = ReqParamsToMap(req);

  let start: number | undefined;
  let limit: number | undefined;
  const conds: API2DeviceConds = {};

  for (const [key, value] of params.entries()) {
    switch (key) {
      case 'NAME':
        conds.name = patternCond(value, 'i');
        continue;
      case 'DEPT':
        conds.dept = patternCond(value, 'i');
        continue;
      case 'DEVICETYPE':
        conds.deviceType = patternCond(value, 'i');
        continue;

      // pagination
      case 'START':
        start = Number(value);
        if (!Number.isInteger(start) || start < 0) {
          throw new RequestError(`Start parameter is invalid: ${value}`, BAD_REQUEST);
        }
        continue;
      case 'LIMIT':
        limit = Number(value);
        if (!Number.isInteger(limit) || limit < 0) {
          throw new RequestError(`Limit parameter is invalid: ${value}`, BAD_REQUEST);
        }
        continue;

      default:
        throw new RequestError(`Filter parameter unsupported: ${key}`, BAD_REQUEST);
    }
  }

  if (debug.enabled) {
    debug('Find devices: Conds: %s, Start: %s, Limit: %s', util.inspect(conds), start, limit);
  }

  const [ devices, groups, checklists ] = await Promise.all([
    Device.find(conds).sort({ name: 1 }).skip(start || 0).limit(limit || 10000).exec(),
    mapById(Group.find({ memberType: Device.modelName }).exec()),
    mapById(Checklist.find({ targetType: { $in: [ Device.modelName, Group.modelName ] }}).exec()),
  ]);

  const pkg: webapi.Pkg<API2Device[]> = { data: [] };
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

    pkg.data.push({
      id: ObjectId(device._id).toHexString(),
      name: device.name,
      desc: device.desc,
      dept: device.dept,
      deviceType: device.deviceType,
      approved: approved,
    });
  }
  res.json(pkg);
}

router.get('/api/v2/devices(;filter)?', ensureAccepts('json'), catchAll(deviceFilterHandler));

router.post('/api/v2/devices;filter', ensureAccepts('json'), catchAll(deviceFilterHandler));


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
    throw new RequestError('Expected checklist not found', INTERNAL_SERVER_ERROR);
  }

  const approved = checklist ? checklist.approved : false;

  const pkg: webapi.Pkg<API2Device> = {
    data: {
      id: ObjectId(device._id).toHexString(),
      name: device.name,
      desc: device.desc,
      dept: device.dept,
      deviceType: device.deviceType,
      approved: approved,
    },
  };
  res.json(pkg);
}));

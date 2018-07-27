/**
 * Route handlers for slots.
 */
import * as dbg from 'debug';
import * as express from 'express';
import * as moment from 'moment';

import * as auth from '../shared/auth';
import * as models from '../shared/models';

import {
  catchAll,
  format,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import {
  Slot,
} from '../models/slot';

import {
  Device,
} from '../models/device';

import {
  IInstall,
  Install,
} from '../models/install';

import {
  Group,
} from '../models/group';

import {
  Checklist,
} from '../models/checklist';

interface RouterOptions {
  adminRoles?: string[];
}

const debug = dbg('runcheck:slots');

const BAD_REQUEST = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

const GRP = auth.RoleScheme.GRP;
const USR = auth.RoleScheme.USR;

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
 * Compute the permissions of the current user for the specified slot.
 *
 * @param req HTTP Request
 * @param slot Model
 */
function getPermissions(req: express.Request, slot: Slot) {
  const ownerRole = auth.formatRole(GRP, slot.area, 'LEADER');
  const assignRoles = [ ownerRole ].concat(adminRoles);
  const assign = auth.hasAnyRole(req, assignRoles);
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', assign, assignRoles.join(' | '));
    debug('PERM: INSTALL: %s (%s)', assign, assignRoles.join(' | '));
    debug('PERM: GROUP: %s (%s)', assign, assignRoles.join(' | '));
  }
  return {
    assign: assign,
    install: assign, // currently permission 'install' same as 'assign'
    group: assign, // currently permission 'group' same as 'assign'
  };
};



router.get('/slots', catchAll(async (req, res) => {
  format(res, {
    'text/html': () => {
      res.render('slots');
    },
    'application/json': async () => {
      const rows: webapi.SlotTableRow[] = [];
      const [ slots, groups, devices, checklists ] = await Promise.all([
        Slot.find().exec(),
        models.mapById(Group.find({ memberType: Slot.modelName }).exec()),
        models.mapById(Device.find({ installSlotId: { $exists: true }}).exec()),
        models.mapById(Checklist.find({ targetType: { $in: [ Slot.modelName, Group.modelName ] }}).exec()),
      ]);
      for (let slot of slots) {
        let perms = getPermissions(req, slot);
        const row: webapi.SlotTableRow = {
          id: models.ObjectId(slot._id).toHexString(),
          name: slot.name,
          desc: slot.desc,
          area: slot.area,
          checklistId: slot.checklistId ? slot.checklistId.toHexString() : undefined,
          deviceType: slot.deviceType,
          careLevel: slot.careLevel,
          safetyLevel: slot.safetyLevel,
          drr: slot.drr,
          arr: slot.arr,
          groupId: slot.groupId ? slot.groupId.toHexString() : undefined,
          installDeviceId: slot.installDeviceId ? slot.installDeviceId.toHexString() : undefined,
          installDeviceBy: slot.installDeviceBy,
          installDeviceOn: slot.installDeviceOn ? slot.installDeviceOn.toISOString() : undefined,
          canAssign: perms.assign,
          canInstall: perms.assign,
          canGroup: perms.group,
        };
        if (slot.installDeviceId) {
          const device = devices.get(slot.installDeviceId.toHexString());
          if (device) {
            row.installDeviceName = device.name;
          } else {
            throw new RequestError(`Installed Device not found: ${slot.installDeviceId}`);
          }
        }
        if (slot.groupId) {
          let group = groups.get(slot.groupId.toHexString());
          if (!group) {
            throw new RequestError(`Slot Group not found: ${slot.groupId}`, INTERNAL_SERVER_ERROR);
          }
          if (group.checklistId) {
            const checklist = checklists.get(group.checklistId.toHexString());
            if (checklist) {
              row.checklistApproved = checklist.approved;
              row.checklistChecked = checklist.checked;
              row.checklistTotal = checklist.total;
            }
          }
        } else if (slot.checklistId) {
          const checklist = checklists.get(slot.checklistId.toHexString());
          if (checklist) {
            row.checklistApproved = checklist.approved;
            row.checklistChecked = checklist.checked;
            row.checklistTotal = checklist.total;
          }
        }
        rows.push(row);
      }
      res.json(<webapi.Pkg<webapi.SlotTableRow[]>> {
        data: rows,
      });
    },
  });
}));

/**
 * Get the slot specified by name or ID
 * and then respond with either HTML or JSON.
 */
router.get('/slots/:name_or_id', catchAll( async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Slot (and history) with name or id: %s', nameOrId);

  let slot: Slot | null;
  if (models.isValidId(nameOrId)) {
    slot = await Slot.findByIdWithHistory(nameOrId);
  } else {
    slot = await Slot.findOneWithHistory({ name: nameOrId.toUpperCase() });
  }

  if (!slot) {
    throw new RequestError('Slot not found', HttpStatus.NOT_FOUND);
  }

  let perms = getPermissions(req, slot);

  const apiSlot: webapi.Slot = {
    id: models.ObjectId(slot._id).toHexString(),
    name: slot.name,
    desc: slot.desc,
    area: slot.area,
    deviceType: slot.deviceType,
    checklistId: slot.checklistId ? slot.checklistId.toHexString() : undefined,
    careLevel: slot.careLevel,
    safetyLevel: slot.safetyLevel,
    drr: slot.drr,
    arr: slot.arr,
    groupId: slot.groupId ? slot.groupId.toHexString() : undefined,
    installDeviceId: slot.installDeviceId ? slot.installDeviceId.toHexString() : undefined,
    installDeviceBy: slot.installDeviceBy,
    installDeviceOn: slot.installDeviceOn ? slot.installDeviceOn.toISOString().split('T')[0] : undefined,
    canAssign: perms.assign,
    canInstall: perms.install,
  };

  return format(res, {
    'text/html': () => {
      res.render('slot', {
        slot: apiSlot,
        moment: moment,
      });
    },
    'application/json': () => {
      res.json(<webapi.Pkg<webapi.Slot>> {
        data: apiSlot,
      });
    },
  });
}));


/**
 * Install Device in Slot
 */
router.put('/slots/:name_or_id/installation', auth.ensureAuthc(), catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Slot with name or id: %s', nameOrId);

  let slot: Slot | null;
  if (models.isValidId(nameOrId)) {
    slot = await Slot.findById(nameOrId).exec();
  } else {
    slot = await Slot.findOne({name: nameOrId.toUpperCase() });
  }

  if (!slot || !slot.id) {
    throw new RequestError('Slot not found', HttpStatus.NOT_FOUND);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissions(req, slot);
  if (!username || !permissions.install) {
    throw new RequestError('Not permitted to install device', HttpStatus.FORBIDDEN);
  }

  let pkg = <webapi.Pkg<webapi.SlotInstall>> req.body;
  if (debug.enabled) {
    debug(`Request data: ${JSON.stringify(pkg)}`);
  }

  if (!pkg.data) {
    throw new RequestError('Invalid request data', BAD_REQUEST);
  }

  if (!pkg.data.installDeviceId) {
    throw new RequestError('Device is required', BAD_REQUEST);
  }

  let deviceId = pkg.data.installDeviceId;
  if (!models.isValidId(deviceId)) {
    throw new RequestError('Device ID is invalid', BAD_REQUEST);
  }

  if (!pkg.data.installDeviceOn) {
    throw new RequestError('Date is required', BAD_REQUEST);
  }

  if (!pkg.data.installDeviceOn.match(/\d{4}-\d{2}-\d{2}/)) {
    throw new RequestError('Date is invalid (1)', BAD_REQUEST);
  }

  let installOn = new Date(pkg.data.installDeviceOn);
  if (!Number.isFinite(installOn.getTime())) {
    throw new RequestError('Date is invalid (2)', BAD_REQUEST);
  }

  debug('Find Device with ID: %s', deviceId);
  debug('Find Install with device ID: %s', deviceId);
  let [ device, install ] = await Promise.all([
    Device.findById(deviceId).exec(),
    Install.findOne({ deviceId: deviceId }).exec(),
  ]);

  if (!device || !device.id) {
    throw new RequestError('Device not found', BAD_REQUEST);
  }

  if (install) {
    throw new RequestError('Device is already installed', BAD_REQUEST);
  }

  if (slot.deviceType !== device.deviceType) {
    throw new RequestError('Device type is not compatible', BAD_REQUEST);
  }

  install = new Install(<IInstall> {
    slotId: models.ObjectId(slot.id),
    deviceId: models.ObjectId(device.id),
    installOn: installOn,
    installBy: auth.formatRole(USR, username),
    state: 'INSTALLING',
  });

  await install.save();

  slot.installDeviceId = install.deviceId;
  slot.installDeviceOn = install.installOn;
  slot.installDeviceBy = install.installBy;

  device.installSlotId = install.slotId;
  device.installSlotOn = install.installOn;
  device.installSlotBy = install.installBy;

  await Promise.all([
    device.saveWithHistory(install.installBy),
    slot.saveWithHistory(install.installBy),
  ]);

  // Is it practical to rollback this change
  // if an error has occurred during update?
  // These minor changes should not result
  // in a validation error, and if this is a
  // network or database error then likely
  // it would be impossible to rollback.

  install.state = 'INSTALLED';
  await install.save();

  let respkg: webapi.Pkg<webapi.SlotInstall> = {
    data: {
      installDeviceId: install.deviceId.toHexString(),
      installDeviceBy: install.installBy,
      installDeviceOn: install.installOn.toISOString().split('T')[0],
    },
  };
  res.json(respkg);
}));

/**
 * Route handlers for devices.
 */
import * as dbg from 'debug';
import * as express from 'express';
import * as moment from 'moment';

import * as auth from '../shared/auth';
import * as log from '../shared/logging';
import * as models from '../shared/models';

import {
  Checklist,
} from '../models/checklist';

import {
  Slot,
} from '../models/slot';

import {
  Device,
} from '../models/device';

import {
  catchAll,
  ensureAccepts,
  format,
  HttpStatus,
  RequestError,
} from '../shared/handlers';


const debug = dbg('runcheck:devices');

let adminRoles: string[] = [ 'ADM:RUNCHECK', 'ADM:CCDB' ];

export function getAdminRoles(): string[] {
  return Array.from(adminRoles);
}

export function setAdminRoles(roles: string[]) {
  adminRoles = Array.from(roles);
}

/**
 * Compute the permissions of the current user for the specified device.
 *
 * @param req HTTP Request
 * @param slot Model
 */
function getPermissions(req: express.Request, device: Device) {
  const ownerRole = auth.formatRole('GRP', device.dept, 'LEADER');
  const assignRoles = [ ownerRole ].concat(adminRoles);
  const assign = auth.hasAnyRole(req, assignRoles);
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', assign, assignRoles.join(' | '));
  }
  return {
    assign: assign,
  };
};



export const router = express.Router();

/**
 * Get the list view of devices (HTML) or list of devices (JSON).
 */
router.get('/devices', catchAll(async (req, res) => {
  return format(res, {
    'text/html': () => {
      res.render('devices', {
        basePath: '..',
      });
    },
    'application/json': async () => {
      let conds: { deviceType?: string } = {};
      for (let param in req.query) {
        if (req.query.hasOwnProperty(param)) {
          if (param.toUpperCase() === 'DEVICETYPE') {
            conds.deviceType = String(req.query[param]);
          }
        }
      }
      if (debug.enabled) {
        debug('Find Devices with %s', JSON.stringify(conds));
      }
      const [ devices, slots, checklists ] = await Promise.all([
        Device.find(conds).exec(),
        models.mapById(Slot.find({ installDeviceId: { $exists: true }}).exec()),
        models.mapById(Checklist.find({ targetType: Device.modelName }).exec()),
      ]);
      const rows: webapi.DeviceTableRow[] =  [];
      for (let device of devices) {
        if (!device.id) {
          continue;
        }
        const row: webapi.DeviceTableRow = {
          id: device.id,
          name: device.name,
          desc: device.desc,
          dept: device.dept,
          deviceType: device.deviceType,
          checklistId: device.checklistId ? device.checklistId.toHexString() : undefined,
        };
        if (device.installSlotId) {
          const slotId = device.installSlotId.toHexString();
          const slot = slots.get(slotId);
          if (slot) {
            row.installSlotName = slot.name;
          } else {
            log.warn('Installation slot not found: %s', slotId);
          }
        }
        if (device.checklistId) {
          let checklist = checklists.get(device.checklistId.toHexString());
          if (checklist) {
            row.checklistApproved = checklist.approved;
            row.checklistChecked = checklist.checked;
            row.checklistTotal = checklist.total;
          }
        }
        rows.push(row);
      }
      res.json(<webapi.Pkg<webapi.DeviceTableRow[]>> {
        data: rows,
      });
    },
  });
}));

/**
 * Get the device specified by name or ID
 * and then respond with either HTML or JSON.
 */
router.get('/devices/:name_or_id', catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Device (and history) with name or id: %s', nameOrId);

  let device: Device | null;
  if (models.isValidId(nameOrId)) {
    device = await Device.findByIdWithHistory(nameOrId);
  } else {
    device = await Device.findOneWithHistory({ name: nameOrId.toUpperCase() });
  }

  if (!device) {
    throw new RequestError('Device not found', HttpStatus.NOT_FOUND);
  }

  let perms = getPermissions(req, device);

  const apiDevice: webapi.Device = {
    id: String(device.id),
    name: device.name,
    desc: device.desc,
    dept: device.dept,
    deviceType: device.deviceType,
    checklistId: device.checklistId ? device.checklistId.toHexString() : undefined,
    installSlotId: device.installSlotId ? device.installSlotId.toHexString() : undefined,
    installSlotBy: device.installSlotBy,
    installSlotOn: device.installSlotOn ? device.installSlotOn.toISOString().split('T')[0] : undefined,
    canAssign: perms.assign,
  };

  return format(res, {
    'text/html': () => {
      res.render('device', {
        device: apiDevice,
        moment: moment,
        basePath: '..',
      });
    },
    'application/json': () => {
      res.json(<webapi.Pkg<webapi.Device>> {
        data: apiDevice,
      });
    },
  });
}));


router.get('/devices/:id/checklistId', ensureAccepts('json'), catchAll(async (req, res) => {
  const id = String(req.params.id);

  debug('Find Device with id: %s', id);
  let device = await Device.findById(id).exec();
  if (!device || !device.id || !device.checklistId) {
    throw new RequestError('Checklist not found', HttpStatus.NOT_FOUND);
  }

  res.json(<webapi.Pkg<string>> {
    data: device.checklistId.toHexString(),
  });
}));

/**
 * Route handlers for slots.
 */
import * as dbg from 'debug';
import * as express from 'express';
import * as moment from 'moment';
//var _ = require('lodash');

import * as auth from '../shared/auth';
import * as log from '../shared/logging';
import * as models from '../shared/models';
//var reqUtils = require('../lib/req-utils');

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
  Checklist,
  IChecklist,
} from '../models/checklist';


const debug = dbg('runcheck:slots');

const BAD_REQUEST = HttpStatus.BAD_REQUEST;

/**
 * Compute the permissions of the current user for the specified slot.
 *
 * @param req HTTP Request
 * @param slot Model
 */
function getPermissions(req: express.Request, slot: Slot) {
  const roles = [ 'ADM:RUNCHECK', auth.formatRole('GRP', slot.area, 'LEADER') ];
  const assign = auth.hasAnyRole(req, roles);
  const install = assign;
  const group = assign;
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', assign, roles.join(' | '));
    debug('PERM: INSTALL: %s (%s)', assign, roles.join(' | '));
    debug('PERM: GROUP: %s (%s)', assign, roles.join(' | '));
  }
  return {
    assign: assign,
    install: install,
    group: group,
  };
};


export const router = express.Router();

router.get('/', catchAll(async (req, res) => {
  format(res, {
    'text/html': () => {
      res.render('slots');
    },
    'application/json': async () => {
      const rows: webapi.SlotTableRow[] = [];
      const [ slots, devices ] = await Promise.all([
        Slot.find().exec(),
        models.mapById(Device.find({ installSlotId: { $exists: true }}).exec()),
      ]);

      for (let slot of slots) {
        let perms: {assign: boolean, install: boolean, group: boolean} = {assign: false, install: false, group: false};
        perms = getPermissions(req, slot);
        const row: webapi.SlotTableRow = {
          id: models.ObjectId(slot._id).toHexString(),
          name: slot.name,
          desc: slot.desc,
          area: slot.area,
          deviceType: slot.deviceType,
          careLevel: slot.careLevel,
          safetyLevel: slot.safetyLevel,
          drr: slot.drr,
          arr: slot.arr,
          groupId: slot.groupId ? slot.groupId.toHexString() : undefined,
          canGroup: perms.group,
        };
        if (slot.installDeviceId) {
          const deviceId = slot.installDeviceId.toHexString();
          const device = devices.get(deviceId);
          if (device) {
            row.installDeviceName = device.name;
          } else {
            log.warn('Installation device not found: %s', deviceId);
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

// router.get('/json', auth.ensureAuthenticated, catchAll(async (req, res) => {
//   Slot.find(function (err, docs) {
//     if (err) {
//       log.error(err);
//       return res.status(500).send(err.message);
//     }
//     // data just for test.
//     var slotDocs = docs.map(function (s) {
//       return {
//         _id: s._id,
//         name: s.name,
//         owner: 'wen',
//         area: 'unknow in xlsx',
//         level: s.level,
//         deviceType: s.deviceType,
//         location: [s.coordinateX, s.coordinateY, s.coordinateZ],
//         status: s.status,
//         device: s.device,
//         machineMode: s.machineMode,
//         ReadinessCheckedValue: 10,
//         ReadinessTotalValue: 10,
//         DRRCheckedValue: 4,
//         DRRTotalValue: 10,
//         ARRCheckedValue: 0,
//         ARRTotalValue: 10
//       }
//     });
//     res.status(200).json(slotDocs);
//   });
// }));


/**
 * Get the slot specified by name or ID
 * and then respond with either HTML or JSON.
 */
router.get('/:name_or_id', catchAll( async (req, res) => {
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
    checklistId: slot.checklistId ? slot.checklistId.toHexString() : null,
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
 * Assign a Checklist to the specified slot.
 */
router.put('/:name_or_id/checklistId', auth.ensureAuthenticated, catchAll(async (req, res) => {
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
  if (!username || !permissions.assign) {
    throw new RequestError('Not permitted to assign checklist', HttpStatus.FORBIDDEN);
  }

  if (!slot.installDeviceId) {
    throw new RequestError('Device must be installed', BAD_REQUEST);
  }

  if (slot.checklistId) {
    throw new RequestError('Slot already assigned checklist', HttpStatus.BAD_REQUEST);
  }

  let checklistType: 'slot-default';

  switch (slot.safetyLevel) {
  case 'NORMAL':
  case 'CONTROL':
  default:
    checklistType = 'slot-default'; // UPPERCASE?
    break;
  case 'CREDITED':
    checklistType = 'slot-default'; // 'SLOT_CREDITED';
    break;
  case 'ESHIMPACT':
    checklistType = 'slot-default'; // 'SLOT_ESHIMPACT';
    break;
  }

  const doc: IChecklist = {
    checklistType: checklistType,
    targetType: models.getModelName(slot),
    targetId: models.ObjectId(slot._id),
  };

  debug('Create new Checklist with type: %s', doc.checklistType);
  const checklist = await Checklist.create(doc);

  debug('Update Slot with new checklist id: %s', checklist._id);
  slot.checklistId = models.ObjectId(checklist._id);
  await slot.saveWithHistory(auth.formatRole('USR', username ));

  res.status(HttpStatus.CREATED).json(<webapi.Pkg<string>> {
    data: slot.checklistId.toHexString(),
  });
}));

/**
 * Install Device in Slot
 */
router.put('/:name_or_id/installation', auth.ensureAuthenticated, catchAll(async (req, res) => {
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
    installBy: auth.formatRole('USR', username),
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

// var slotTransition = [
//   '1-2',
//   '2-2.5',
//   '2-3',
//   '2.5-3',
//   '3-4'
// ];

// router.put('/:id/device/:toid/status', auth.ensureAuthenticated, reqUtils.exist('id', Slot), reqUtils.hasAll('body', ['status']), function (req, res) {
//   var slot = req[req.params['id']];
//   if (slot.device.id !== req.params.toid) {
//     return res.status(400).send('The current installed device is not ' + req.params.toid);
//   }
//   if (!_.isNumber(req.body.status)) {
//     return res.status(400).send('Need a number for the status.');
//   }
//   if (slot.status === req.body.status) {
//     return res.status(200).send('Status not changed.');
//   }
//   if (slotTransition.indexOf(slot.status + '-' + req.body.status) === -1) {
//     return res.status(400).send('The status change is not allowed.');
//   }
//   slot.status = req.body.status;
//   slot.saveWithHistory(req.session.userid, function (sErr, newSlot) {
//     if (sErr) {
//       log.error(sErr);
//       return res.status(500).send(sErr.message);
//     }
//     newSlot.populate('__updates', function (pErr,fullSlot) {
//       if (pErr) {
//         log.error(pErr);
//         return res.status(500).send(pErr.message);
//       }
//       return res.json(fullSlot).end();
//     })
//   })
// });
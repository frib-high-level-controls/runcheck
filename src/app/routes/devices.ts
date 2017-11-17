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
  IChecklist,
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

/**
 * Compute the permissions of the current user for the specified device.
 *
 * @param req HTTP Request
 * @param slot Model
 */
function getPermissions(req: express.Request, device: Device) {
  const ADMIN_ROLE = 'ADM:RUNCHECK';
  const DEPT_LEADER_ROLE = auth.formatRole('GRP', device.dept, 'LEADER');
  const PERM_ASSIGN_ROLES = [ ADMIN_ROLE, DEPT_LEADER_ROLE ];
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', auth.hasAnyRole(req, PERM_ASSIGN_ROLES), PERM_ASSIGN_ROLES.join(' | '));
  }
  return {
    assign: auth.hasAnyRole(req, PERM_ASSIGN_ROLES),
  };
};



export const router = express.Router();

/**
 * Get the list view of devices (HTML) or list of devices (JSON).
 */
router.get('/', catchAll(async (req, res) => {
  return format(res, {
    'text/html': () => {
      res.render('devices');
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
      const [ devices, slots ] = await Promise.all([
        Device.find(conds).exec(),
        models.mapById(Slot.find({ installDeviceId: { $exists: true }}).exec()),
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
router.get('/:name_or_id', catchAll(async (req, res) => {
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

  const apiDevice: webapi.Device = {
    id: String(device.id),
    name: device.name,
    desc: device.desc,
    dept: device.dept,
    deviceType: device.deviceType,
    checklistId: device.checklistId ? device.checklistId.toHexString() : null,
    installSlotId: device.installSlotId ? device.installSlotId.toHexString() : undefined,
    installSlotBy: device.installSlotBy,
    installSlotOn: device.installSlotOn ? device.installSlotOn.toISOString() : undefined,
    perms: getPermissions(req, device),
  };

  return format(res, {
    'text/html': () => {
      res.render('device', {
        device: apiDevice,
        moment: moment,
      });
    },
    'application/json': () => {
      res.json(<webapi.Pkg<webapi.Device>> {
        data: apiDevice,
      });
    },
  });
}));


router.get('/:id/checklistId', ensureAccepts('json'), catchAll(async (req, res) => {
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


router.put('/:name_or_id/checklistId', auth.ensureAuthenticated, catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Device with name or id: %s', nameOrId);

  let device: Device | null;
  if (models.isValidId(nameOrId)) {
    device = await Device.findById(nameOrId).exec();
  } else {
    device = await Device.findOne({ name: nameOrId.toUpperCase() });
  }

  if (!device || !device.id) {
    throw new RequestError('Device not found', HttpStatus.NOT_FOUND);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissions(req, device);
  if (!username || !permissions.assign) {
    throw new RequestError('Not permitted to assign checklist', HttpStatus.FORBIDDEN);
  }

  if (device.checklistId) {
    log.warn('Device already has checklist id: %s', device.checklistId);
    res.status(HttpStatus.OK).json({
      data: device.checklistId.toHexString(),
    });
    return;
  }

  const doc: IChecklist = {
    checklistType: 'device-default',
    targetType: models.getModelName(device),
    targetId: device._id,
  };

  debug('Create new Checklist with type: %s', doc.checklistType);
  const checklist = await Checklist.create(doc);

  debug('Update Device with new checklist id: %s', checklist._id);
  device.checklistId = models.ObjectId(checklist._id);
  await device.saveWithHistory(auth.formatRole('USR', username));

  res.status(HttpStatus.CREATED).json(<webapi.Pkg<string>> {
    data: device.checklistId.toHexString(),
  });
}));

/*
devices.put('/:id/install-to-device', auth.ensureAuthenticated, reqUtils.exist('id', Device), reqUtils.hasAll('body', ['targetId']), reqUtils.exist('targetId', Device, '_id', 'body'), function (req, res) {
  var device = req[req.params['id']];
  var target = req[req.body['targetId']];
  if (device.installToDevice.id || device.installToSlot.id) {
    return res.status(400).send('The device already had a install-to target.');
  }

  if (req.params.id === req.body.targetId) {
    return res.status(400).send('Cannot install a device to itself.');
  }

  // update
  device.set({
    installToDevice: {
      id: target._id,
      serialNo: target.serialNo
    },
    status: 1
  });
  device.saveWithHistory(req.session.userid, function (err, newDevice) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    newDevice.populate('__updates', function (pErr, d) {
      if (pErr) {
        log.error(pErr);
        return res.status(500).send(pErr.message);
      }
      return res.json(d);
    })
  });
});

devices.delete('/:id/install-to-device/:toid', auth.ensureAuthenticated, reqUtils.exist('id', Device), function (req, res) {
  var device = req[req.params['id']];
  if (_.get(device, 'installToDevice.id') !== req.params.toid) {
    return res.status(400).send('The current install-to-device is not ' + req.params.toid);
  }

  // update
  device.installToDevice.id = null;
  device.installToDevice.serialNo = null;
  device.status = 0;
  device.saveWithHistory(req.session.userid, function (err, newDevice) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    newDevice.populate('__updates', function (pErr, d) {
      if (pErr) {
        log.error(pErr);
        return res.status(500).send(pErr.message);
      }
      return res.json(d);
    })
  });
});

var deviceTransition = [
  '0-1',
  '1-1.5',
  '1-2',
  '1-0',
  '1.5-2',
  '1.5-0',
  '2-3',
  '2-0',
  '3-0'
];

devices.put('/:id/install-to-device/:toid/status', auth.ensureAuthenticated, reqUtils.exist('id', Device), reqUtils.hasAll('body', ['status']), function (req, res) {
  var device = req[req.params['id']];
  if (device.installToDevice.id !== req.params.toid) {
    return res.status(400).send('The current install-to-device is not ' + req.params.toid);
  }

  if (!_.isNumber(req.body.status)) {
    return res.status(400).send('Need a number for the status.');
  }
  // validate transition
  if (device.status === req.body.status) {
    return res.status(200).send('Status not changed.');
  }
  if (deviceTransition.indexOf(device.status + '-' + req.body.status) === -1) {
    return res.status(400).send('The status change is not allowed.');
  }
  // update
  device.status = req.body.status;
  if (device.status === 0) {
    device.installToDevice.id = null;
    device.installToDevice.serialNo = null;
  }

  device.saveWithHistory(req.session.userid, function (err, newDevice) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    newDevice.populate('__updates', function (pErr, d) {
      if (pErr) {
        log.error(pErr);
        return res.status(500).send(pErr.message);
      }
      return res.json(d);
    })
  });
});

devices.put('/:id/install-to-slot', auth.ensureAuthenticated, reqUtils.exist('id', Device), reqUtils.hasAll('body', ['targetId']), reqUtils.exist('targetId', Slot, '_id', 'body'), function (req, res) {
  var device = req[req.params['id']];
  var slot = req[req.body['targetId']];
  if (device.installToDevice.id || device.installToSlot.id) {
    return res.status(400).send('The device already has a install-to target.');
  }
  var deviceSlot = new DeviceSlot({
    deviceId: device._id,
    slotId: slot._id
  });
  deviceSlot.save(function (err) {
    if (err) {
      log.error(err);
      if (err.code === 11000) {
        return res.status(400).send('The device already has a install-to-slot target.');
      }
      return res.status(500).send(err.message);
    }
    // update slot
    slot.set({
      device: {
        id: device._id,
        serialNo: device.serialNo
      }
    });
    slot.saveWithHistory(req.session.userid, function (err) {
      if (err) {
        log.error(err);
        return res.status(500).send(err.message);
      }
      // update device
      device.set({
        installToSlot: {
          id: slot._id,
          name: slot.name
        },
        status: 1
      });
      device.saveWithHistory(req.session.userid, function (dErr, newDevice) {
        if (dErr) {
          log.error(err);
          return res.status(500).send(dErr.message);
        }
        newDevice.populate('__updates', function (pErr, d) {
          if (pErr) {
            log.error(pErr);
            return res.status(500).send(pErr.message);
          }
          return res.json(d);
        })
      });
    });
  });
});


devices.delete('/:id/install-to-slot/:toid', auth.ensureAuthenticated, reqUtils.exist('id', Device),  reqUtils.exist('toid', Slot), deleteInstallToSlot);

function deleteInstallToSlot(req, res) {
  var device = req[req.params['id']];
  var slot = req[req.params['toid']];
  DeviceSlot.remove({
    deviceId: req.params.id,
    slotId: req.params.toid
  }, function (err, raw) {
    if (err) {
      return res.status(500).send(err.message);
    }
    if (raw.result.n === 0) {
      return res.status(404).send('The current install-to-slot is not ' + req.params.toid);
    }
    // slot
    slot.device.id = null;
    slot.device.serialNo = null;
    slot.status = 0;
    slot.saveWithHistory(req.session.userid, function (sErr) {
      if (sErr) {
        log.error(sErr);
        return res.status(500).send(sErr.message);
      }
      // update device
      device.installToSlot.id = null;
      device.installToSlot.name = null;
      device.status = 0;
      device.saveWithHistory(req.session.userid, function (dErr, newDevice) {
        if (dErr) {
          log.error(dErr);
          return res.status(500).send(dErr.message);
        }
        newDevice.populate('__updates', function (pErr, d) {
          if (pErr) {
            log.error(pErr);
            return res.status(500).send(pErr.message);
          }
          return res.json(d);
        })
      });
    });
  });
}

devices.put('/:id/install-to-slot/:toid/status', auth.ensureAuthenticated, reqUtils.exist('id', Device), reqUtils.exist('toid', Slot), reqUtils.hasAll('body', ['status']), function (req, res) {
  var device = req[req.params['id']];
  if (device.installToSlot.id !== req.params.toid) {
    return res.status(400).send('The current install-to-slot is not ' + req.params.toid);
  }
  if (!_.isNumber(req.body.status)) {
    return res.status(400).send('Need a number for the status.');
  }
  // validate transition
  if (device.status === req.body.status) {
    return res.status(200).send('Status not changed.');
  }
  if (deviceTransition.indexOf(device.status + '-' + req.body.status) === -1) {
    return res.status(400).send('The status change is not allowed.');
  }
  // update
  device.status = req.body.status;
  if (device.status === 0) {
    deleteInstallToSlot(req, res);
  }else {
    device.saveWithHistory(req.session.userid, function (err, newDevice) {
      if (err) {
        log.error(err);
        return res.status(500).send(err.message);
      }
      newDevice.populate('__updates', function (pErr, d) {
        if (pErr) {
          log.error(pErr);
          return res.status(500).send(pErr.message);
        }
        if(device.status !== 3){
          return res.json(d);
        }
        // update slot
        var slot = req[req.params.toid];
        slot.status = 1;
        slot.saveWithHistory(req.session.userid, function (sErr) {
          if (sErr) {
            log.error(sErr);
            return res.status(500).send(sErr.message);
          }
          return res.json(d);
        })
      })
    });
  }
});

module.exports = devices;
*/

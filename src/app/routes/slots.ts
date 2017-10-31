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
  ensureAccepts,
  format,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import {
  ISlot,
  Slot,
} from '../models/slot';

import {
  Device,
} from '../models/device';

const debug = dbg('runcheck:slots');

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
        const row: webapi.SlotTableRow = {
          id: models.ObjectId(slot._id).toHexString(),
          name: slot.name,
          desc: slot.desc,
          area: slot.area,
          deviceType: slot.deviceType,
          careLevel: slot.careLevel,
          drr: slot.drr,
          arr: slot.arr,
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

// '^[a-fA-F\\d]{24}$'

router.get('/:name_or_id', catchAll( async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Slot (and history) with name or id: %s', nameOrId);

  let slot: Slot | null;
  let device: Device | null | undefined;
  if (models.isValidId(nameOrId)) {
    slot = await Slot.findByIdWithHistory(nameOrId);
  } else {
    slot = await Slot.findOneWithHistory({ name: nameOrId.toUpperCase() });
  }

  if (!slot) {
    throw new RequestError('Slot not found', HttpStatus.NOT_FOUND);
  }

  const apiSlot: webapi.Slot = {
    id: models.ObjectId(slot._id).toHexString(),
    name: slot.name,
    desc: slot.desc,
    area: slot.area,
    deviceType: slot.deviceType,
    checklistId: slot.checklistId ? slot.checklistId.toHexString() : null,
    careLevel: slot.careLevel,
    drr: slot.drr,
    arr: slot.arr,
    installDeviceId: slot.installDeviceId ? slot.installDeviceId.toHexString() : undefined,
    installDeviceBy: slot.installDeviceBy,
    installDeviceOn: slot.installDeviceOn ? slot.installDeviceOn.toISOString() : undefined,
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

var express = require('express');
var devices = express.Router();
var auth = require('../lib/auth');
var Device = require('../models/device').Device;
var Slot = require('../models/slot').Slot;
var DeviceSlot = require('../models/device-slot').DeviceSlot;
var Checklist = require('../models/checklist').Checklist;
var defaultDeviceChecklist = require('../models/checklist').defaultDeviceChecklist;
var log = require('../lib/log');
var reqUtils = require('../lib/req-utils');
var debug = require('debug')('runcheck:devices');
var _ = require('lodash');
var moment = require('moment');

devices.get('/', auth.ensureAuthenticated, function (req, res) {
  res.render('devices');
});


devices.get('/json', auth.ensureAuthenticated, function (req, res) {
  Device.find(function (err, devices) {
    if (err) {
      return res.status(500).json({
        error: {
          status: err
        }
      });
    }
    return res.status(200).json(devices);
  });
});


devices.get('/:id', auth.ensureAuthenticated, reqUtils.exist('id', Device), function (req, res) {
  var device = req[req.params.id];
  debug(device.installToDevice);
  debug(device.installToSlot);
  device.populate('__updates', function (pErr, newDevice) {
    if (pErr) {
      log.error(pErr);
      return res.status(500).send(pErr.message);
    }
    return res.render('device', {
      device: newDevice,
      moment: moment,
      _: _
    });
  });
});


devices.put('/:id/checklist/json', auth.ensureAuthenticated, function (req, res) {
  Device.findById(req.params['id']).exec().catch(function (err) {
    console.log('warn: Error retrieving Device (' + req.params['id'] + '): ' + err);
    return Promise.reject({
      error: err,
      status: 404,
      body: {
        error: {
          message: 'device not found'
        }
      }
    });
  })

  .then(function (device) {
    if ((device.owner !== req.session.userid) && !req.session.roles[device.owner]) {
      return Promise.reject({
        error: new Error('User forbidden to create checklist'),
        status: 403,
        body: {
          error: {
            message: 'forbidden to create checklist'
          }
        }
      });
    }
    var p, checklist;
    if (!_.isNil(device.checklist)) {
      p = Checklist.findById(device.checklist).exec().catch(function (err) {
        console.log('warn: Error retrieving Checklist (' + device.checklist + '): ' + err);
        return Promise.reject({
          error: err,
          status: 500,
          body: {
            error: {
              message: 'error retrieving checklist'
            }
          }
        });
      });
      return Promise.all([ device, p ]);
    }
    checklist = new Checklist({
      target: device._id,
      type: 'device'
    });
    p = checklist.save().catch(function (err) {
      console.log('warn: Error saving checklist: ' + err);
      return Promise.reject({
        error: err,
        status: 500,
        body: {
          error: {
            message: 'error saving checklist'
          }
        }
      });
    });
    return Promise.all([ device, p ]);
  })

  .then(function ([device, checklist]) {
    if (device.checklist && device.checklist.equals(checklist._id)) {
      return device;
    }
    device.checklist = checklist._id;
    return device.saveWithHistory(req.session.userid).catch(function (err) {
      console.log('warn: Error saving device: ' + err);
      return Promise.reject({
        error: err,
        status: 500,
        body: {
          error: {
            message: 'error saving device'
          }
        }
      });
    });
  })

  .then(function (device) {
    res.status(200).json(device)
  })

  .catch(function (err) {
    var status = err.status || 500;
    if (!err.body) {
      console.log('warn: Responding to unhandled error');
      console.log(err);
      return res.status(status).json({
        error: {
          message: 'unknown error'
        }
      });
    }
    return res.status(status).json(err.body);
  });
});


devices.get('/:id/json', auth.ensureAuthenticated, function (req, res) {
  Device.findById(req.params['id'], function (err, device) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    res.status(200).json(device);
  });
});


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

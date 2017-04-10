var express = require('express');
var slots = express.Router();
var auth = require('../lib/auth');
var Slot = require('../models/slot').Slot;
var log = require('../lib/log');
var reqUtils = require('../lib/req-utils');
var moment = require('moment');
var _ = require('lodash');

slots.get('/', auth.ensureAuthenticated, function (req, res) {
  res.render('slots');
});

slots.get('/json', auth.ensureAuthenticated, function (req, res) {
  Slot.find(function (err, docs) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    // data just for test.
    var slotDocs = docs.map(function (s) {
      return {
        _id: s._id,
        name: s.name,
        owner: 'wen',
        area: 'unknow in xlsx',
        level: s.level,
        deviceType: s.deviceType,
        location: [s.coordinateX, s.coordinateY, s.coordinateZ],
        status: s.status,
        device: s.device,
        machineMode: s.machineMode,
        ReadinessCheckedValue: 10,
        ReadinessTotalValue: 10,
        DRRCheckedValue: 4,
        DRRTotalValue: 10,
        ARRCheckedValue: 0,
        ARRTotalValue: 10
      }
    });
    res.status(200).json(slotDocs);
  });
});


slots.get('/:id', auth.ensureAuthenticated, reqUtils.exist('id', Slot), function (req, res) {
  var slot = req[req.params.id];
  slot.populate(['__updates','inGroup'], function (pErr, fullSlot) {
    if (pErr) {
      log.error(pErr);
      return res.status(500).send(pErr.message);
    }
    return res.render('slot', {
      slot: fullSlot,
      moment: moment
    });
  });
});


slots.get('/:id/json', auth.ensureAuthenticated, function (req, res) {
  Slot.findOne({
    _id: req.params.id
  }, function (err, doc) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    res.status(200).send(doc);
  });
});

var slotTransition = [
  '1-2',
  '2-2.5',
  '2-3',
  '2.5-3',
  '3-4'
];

slots.put('/:id/device/:toid/status', auth.ensureAuthenticated, reqUtils.exist('id', Slot), reqUtils.hasAll('body', ['status']), function (req, res) {
  var slot = req[req.params['id']];
  if (slot.device.id !== req.params.toid) {
    return res.status(400).send('The current installed device is not ' + req.params.toid);
  }
  if (!_.isNumber(req.body.status)) {
    return res.status(400).send('Need a number for the status.');
  }
  if (slot.status === req.body.status) {
    return res.status(200).send('Status not changed.');
  }
  if (slotTransition.indexOf(slot.status + '-' + req.body.status) === -1) {
    return res.status(400).send('The status change is not allowed.');
  }
  slot.status = req.body.status;
  slot.saveWithHistory(req.session.userid, function (sErr, newSlot) {
    if (sErr) {
      log.error(sErr);
      return res.status(500).send(sErr.message);
    }
    newSlot.populate('__updates', function (pErr,fullSlot) {
      if (pErr) {
        log.error(pErr);
        return res.status(500).send(pErr.message);
      }
      return res.json(fullSlot).end();
    })
  })
});

module.exports = slots;

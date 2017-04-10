var express = require('express');
var slotGroups = express.Router();
var auth = require('../lib/auth');
var SlotGroup = require('../models/slot-group').SlotGroup;
var Slot = require('../models/slot').Slot;
var log = require('../lib/log');

slotGroups.get('/', auth.ensureAuthenticated, function (req, res) {
  res.render('slot-groups');
});


slotGroups.get('/json', auth.ensureAuthenticated, function (req, res) {
  SlotGroup.find(function(err, docs) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    res.status(200).json(docs);
  });
});


slotGroups.get('/:id', auth.ensureAuthenticated, function (req, res) {
  SlotGroup.findOne({_id: req.params.id },function(err, doc) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    res.render('slot-group',{group: doc});
  });
});

slotGroups.get('/:id/slots', auth.ensureAuthenticated, function (req, res) {
  SlotGroup.findOne({ _id: req.params.id },{ slots: 1, _id: 0 }, function(err, doc) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    Slot.find({ _id: {$in: doc.slots }},function(err, docs) {
      if (err) {
        log.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(docs);
    });
  });
});


slotGroups.post('/new', auth.ensureAuthenticated, function (req, res) {
  var group = new SlotGroup({ name: req.body.name,
    area: req.body.area,
    description: req.body.description,
    createdBy: req.session.userid,
    createdOn: Date.now()
  });
  group.save(function(err, newDoc) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    var url = '/slotGroups/' + newDoc._id;
    res.set('Location', url);
    return res.status(201).send('You can see the new slot group at <a href="' + url + '">' + url + '</a>');
  });
});

/*
 Validation for adding slot to group, return json data:
 {
 passData:{ // slot Ids can be added
   id:
   name:
   }
 conflictDataName: {
    slot: // conflict slot name
    conflictGroup:// conflict slot group name
   }
 }
 */
slotGroups.post('/validateAdd', auth.ensureAuthenticated, function (req, res) {
  var passData = [];
  var conflictDataName = [];
  var count = 0;
  Slot.find({
    '_id': {$in: req.body.slotIds}
  }, function (err, docs) {
    if (err) {
      log.error(err);
      return res.status(500).send(err.message);
    }
    if(docs.ength === 0) {
      return res.status(404).send('slots not found.');
    }
    // divied two parts by inGroup failed
    var conflictData = [];
    docs.forEach(function (d) {
      if (d.inGroup) {
        conflictData.push(d);
      } else {
        passData.push({id: d._id,
          name: d.name});
      }
    });

    if(conflictData.length > 0) {
      conflictData.forEach(function (r) {
        SlotGroup.findOne({'_id': r.inGroup}, function(err, conflictGroup) {
          if(err){
            log.error(err);
            return res.status(500).send(err.message);
          }
          if(conflictGroup == null) {
            return res.status(404).send(r.inGroup + ' not found.');
          }
          conflictDataName.push({
            slot: r.name,
            conflictGroup: conflictGroup.name
          });
          count = count + 1;
          if (count === conflictData.length) {
            res.status(200).json({
              passData: passData,
              conflictDataName: conflictDataName
            });
          }
        });
      });
    }else {
      res.status(200).json({
        passData: passData,
        conflictDataName: conflictDataName
      });
    }
  });
});


slotGroups.post('/:gid/addSlots', function (req, res) {
  var passData = req.body.passData;
  var count = 0;
  var errMsg = [];
  var doneMsg = [];
  passData.forEach(function(d){
    Slot.update({_id: d.id, inGroup: null}, {inGroup: req.params.gid}, function(err,raw) {
      if(err || raw.nModified == 0) {
        var msg = err ? err.message : d.name + ' not matched';
        log.error(msg);
        errMsg.push('Failed: ' + d.name + msg);
        count++;
        if (count === passData.length ) {
          return res.status(201).json({
            errMsg: errMsg,
            doneMsg: doneMsg
          });
        }
      }else {
        SlotGroup.update({_id: req.params.gid}, {$addToSet: {slots: d.id} }, function(err,raw) {
          count++;
          if(err || raw.nModified == 0) {
            var msg = err ? err.message : 'group not matched';
            log.error(msg);
            errMsg = errMsg.push('Failed: ' + msg);
          }else {
            doneMsg.push('Success: ' + d.name + ' is added.');
          }
          if (count === passData.length ) {
            return res.status(201).json({
              errMsg: errMsg,
              doneMsg: doneMsg
            });
          }
        })
      }
    });
  });
});


slotGroups.post('/:gid/removeSlots', function (req, res) {
  var passData = req.body.passData;
  var count = 0;
  var errMsg = [];
  var doneMsg = [];
  passData.forEach(function(d){
    Slot.update({_id: d.id, inGroup: { $ne : null }}, {inGroup: null}, function(err, raw) {
      if(err || raw.nModified == 0) {
        count++;
        var msg = err ? err.message : d.name + ' not matched';
        log.error(msg);
        errMsg.push('Failed: ' + msg);
        if (count === passData.length ) {
          return res.status(201).json({
            errMsg: errMsg,
            doneMsg: doneMsg
          });
        }
      }else {
        SlotGroup.update({_id: req.params.gid}, {$pull: {slots: d.id} }, function(err,raw) {
          count++;
          if(err || raw.nModified == 0) {
            var msg = err ? err.message : 'group not matched';
            log.error(msg);
            errMsg = errMsg.push('Failed: ' + msg);
          }else {
            doneMsg.push('Success: ' + d.name + ' is removed.');
          }
          if (count === passData.length ) {
            return res.status(200).json({
              errMsg: errMsg,
              doneMsg: doneMsg
            });
          }
        })
      }
    });
  });
});

module.exports = slotGroups;
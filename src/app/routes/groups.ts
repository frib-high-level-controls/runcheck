/**
 * Route handlers for (slot) groups.
 */
import * as dbg from 'debug';
import * as express from 'express';

//import * as auth from '../shared/auth';

import {
  isValidId,
  mapById,  
  ObjectId,
} from '../shared/models';

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
  Group,
} from '../models/group';

import {
  Checklist,
} from '../models/checklist';

const debug = dbg('runcheck:groups');

export const router = express.Router();

router.get('/slot', catchAll(async (req, res) => {
  format(res, {
    'text/html': () => {
      res.render('slot-groups');
    },
    'application/json': async () => {
      const rows: webapi.GroupTableRow[] = [];
      const [ groups, checklists ] = await Promise.all([
        Group.find({ memberType: Slot.modelName }).exec(),
        mapById(Checklist.find({ targetType: Group.modelName }).exec()),
      ]);
      for (let group of groups) {
        let row: webapi.GroupTableRow = {
          id: group._id,
          name: group.name,
          desc: group.desc,
          checklistId: group.checklistId ? group.checklistId.toHexString() : undefined,
        };
        if (group.checklistId) {
          let checklist = checklists.get(group.checklistId.toHexString());
          if (checklist) {
            row.checklistApproved = checklist.approved;
            row.checklistChecked = checklist.checked;
            row.checklistTotal = checklist.total;
          }
        }
        rows.push(row);
      }

      res.json(<webapi.Pkg<webapi.GroupTableRow[]>> {
        data: rows,
      });
    },
  });
}));


router.get('/slot/:name_or_id', catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Group with name or id: %s', nameOrId);

  let group: Group | null;
  if (isValidId(nameOrId)) {
    group = await Group.findById(nameOrId).exec();
  } else {
    group = await Group.findOne({ name: nameOrId.toUpperCase() });
  }

  if (!group || !group.id) {
    throw new RequestError('Group not found', HttpStatus.NOT_FOUND);
  }

  const apiGroup: webapi.Group = {
    id: ObjectId(group._id).toHexString(),
    name: group.name,
    desc: group.desc,
    owner: group.owner,
    checklistId: group.checklistId ? group.checklistId.toHexString() : undefined,
  };

  return format(res, {
    'text/html': () => {
      res.render('slot-group', {
        group: apiGroup,
      });
    },
    'application/json': () => {
      res.json(<webapi.Pkg<webapi.Group>> {
        data: apiGroup,
      });
    },
  });
}));


router.get('/slot/:id/members', catchAll(async (req, res) => {
  const id = String(req.params.id);
  // if (!group) {
  //   throw new RequestError('Group not found', HttpStatus.NOT_FOUND);
  // }
  const slots = await Slot.find({ groupId: id }).exec();
 // let slots = await Slot.find({ groupId: group._id });
  const webSlots: webapi.Slot[] = [];
  for (let slot of slots) {
    webSlots.push({
      id: ObjectId(slot._id).toHexString(),
      name: slot.name,
      desc: slot.desc,
      area: slot.area,
      deviceType: slot.deviceType,
      checklistId: slot.checklistId ? ObjectId(slot.checklistId).toHexString() : undefined,
      careLevel: slot.careLevel,
      safetyLevel: slot.safetyLevel,
      arr: slot.arr,
      drr: slot.drr,
    });
  }
  res.json(<webapi.Pkg<webapi.Slot[]>> {
    data: webSlots,
  });
}));


// router.post('/new', auth.ensureAuthenticated, catchAll(async (req, res) => {
//   let group = new SlotGroup({ name: req.body.name,
//     area: req.body.area,
//     description: req.body.description,
//     //createdBy: req.session.userid,
//     //createdOn: Date.now()
//   });
//   group.save((err, newDoc) => {
//     if (err) {
//       log.error(err);
//       return res.status(500).send(err.message);
//     }
//     let url = '/slotGroups/' + newDoc._id;
//     res.set('Location', url);
//     return res.status(201).send('You can see the new slot group at <a href="' + url + '">' + url + '</a>');
//   });
// }));

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
// router.post('/validateAdd', auth.ensureAuthenticated, function (req, res) {
//   var passData = [];
//   var conflictDataName = [];
//   var count = 0;
//   Slot.find({
//     '_id': {$in: req.body.slotIds}
//   }, function (err, docs) {
//     if (err) {
//       log.error(err);
//       return res.status(500).send(err.message);
//     }
//     if(docs.ength === 0) {
//       return res.status(404).send('slots not found.');
//     }
//     // divied two parts by inGroup failed
//     var conflictData = [];
//     docs.forEach(function (d) {
//       if (d.inGroup) {
//         conflictData.push(d);
//       } else {
//         passData.push({id: d._id,
//           name: d.name});
//       }
//     });

//     if(conflictData.length > 0) {
//       conflictData.forEach(function (r) {
//         SlotGroup.findOne({'_id': r.inGroup}, function(err, conflictGroup) {
//           if(err){
//             log.error(err);
//             return res.status(500).send(err.message);
//           }
//           if(conflictGroup == null) {
//             return res.status(404).send(r.inGroup + ' not found.');
//           }
//           conflictDataName.push({
//             slot: r.name,
//             conflictGroup: conflictGroup.name
//           });
//           count = count + 1;
//           if (count === conflictData.length) {
//             res.status(200).json({
//               passData: passData,
//               conflictDataName: conflictDataName
//             });
//           }
//         });
//       });
//     }else {
//       res.status(200).json({
//         passData: passData,
//         conflictDataName: conflictDataName
//       });
//     }
//   });
// });


// slotGroups.post('/:gid/addSlots', function (req, res) {
//   var passData = req.body.passData;
//   var count = 0;
//   var errMsg = [];
//   var doneMsg = [];
//   passData.forEach(function(d){
//     Slot.update({_id: d.id, inGroup: null}, {inGroup: req.params.gid}, function(err,raw) {
//       if(err || raw.nModified == 0) {
//         var msg = err ? err.message : d.name + ' not matched';
//         log.error(msg);
//         errMsg.push('Failed: ' + d.name + msg);
//         count++;
//         if (count === passData.length ) {
//           return res.status(201).json({
//             errMsg: errMsg,
//             doneMsg: doneMsg
//           });
//         }
//       }else {
//         SlotGroup.update({_id: req.params.gid}, {$addToSet: {slots: d.id} }, function(err,raw) {
//           count++;
//           if(err || raw.nModified == 0) {
//             var msg = err ? err.message : 'group not matched';
//             log.error(msg);
//             errMsg = errMsg.push('Failed: ' + msg);
//           }else {
//             doneMsg.push('Success: ' + d.name + ' is added.');
//           }
//           if (count === passData.length ) {
//             return res.status(201).json({
//               errMsg: errMsg,
//               doneMsg: doneMsg
//             });
//           }
//         })
//       }
//     });
//   });
// });


// slotGroups.post('/:gid/removeSlots', function (req, res) {
//   var passData = req.body.passData;
//   var count = 0;
//   var errMsg = [];
//   var doneMsg = [];
//   passData.forEach(function(d){
//     Slot.update({_id: d.id, inGroup: { $ne : null }}, {inGroup: null}, function(err, raw) {
//       if(err || raw.nModified == 0) {
//         count++;
//         var msg = err ? err.message : d.name + ' not matched';
//         log.error(msg);
//         errMsg.push('Failed: ' + msg);
//         if (count === passData.length ) {
//           return res.status(201).json({
//             errMsg: errMsg,
//             doneMsg: doneMsg
//           });
//         }
//       }else {
//         SlotGroup.update({_id: req.params.gid}, {$pull: {slots: d.id} }, function(err,raw) {
//           count++;
//           if(err || raw.nModified == 0) {
//             var msg = err ? err.message : 'group not matched';
//             log.error(msg);
//             errMsg = errMsg.push('Failed: ' + msg);
//           }else {
//             doneMsg.push('Success: ' + d.name + ' is removed.');
//           }
//           if (count === passData.length ) {
//             return res.status(200).json({
//               errMsg: errMsg,
//               doneMsg: doneMsg
//             });
//           }
//         })
//       }
//     });
//   });
// });

/**
 * Route handlers for (slot) groups.
 */
import * as dbg from 'debug';
import * as express from 'express';

//import * as auth from '../shared/auth';

import {
  ObjectId,
  isValidId,
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

const debug = dbg('runcheck:groups')

export const router = express.Router();

router.get('/slot', catchAll(async (req, res) => {
  format(res, {
    'text/html': () => {
      res.render('slot-groups');
    },
    'application/json': async () => {
      const rows: webapi.GroupTableRow[] = [];
      const groups = await Group.find({ memberType: Slot.modelName }).exec();
      for (let group of groups) {
        rows.push({
          id: group._id,
          name: group.name,
          desc: group.desc,
        });
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
    checklistId: group.checklistId ? group.checklistId.toHexString() : null,
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
      checklistId: slot.checklistId ? ObjectId(slot.checklistId).toHexString() : null,
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


router.post('/:gid/addSlots', catchAll(async (req, res) => {
  let passData: {id: string | undefined} = req.body.passData;
  let errMsg: string = '';
  if (!passData.id) {
    throw new RequestError('Slot to Add is not found', HttpStatus.NOT_FOUND);
  }
  console.log('Adding slot %s to groupId %s', passData.id, req.params.gid);
  Slot.update({_id: passData.id, groupId: null}, {groupId: req.params.gid}, function(err,raw) {
    if(err || raw.nModified == 0) {
      let msg = err ? err.message : passData.id + ' not matched';
      console.error(msg);
      errMsg = 'Failed to Add: ' + passData.id + msg;
      return res.status(201).json({
          errMsg: errMsg,
          doneMsg: ''
      });
    }
    return res.status(200).json({
      errMsg: '',
      doneMsg: 'Added successfully'
    });
  });
}));

router.post('/:gid/removeSlots', catchAll(async (req, res) => {
  let passData = req.body.passData;
  let count = 0;
  let errMsg: string[] = [];
  let doneMsg: string[] = [];
  passData.forEach(function(d: any){
    Slot.update({_id: d.id, groupId: { $ne : null }}, {groupId: null}, function(err, raw) {
      if(err || raw.nModified == 0) {
        count++;
        let msg = err ? err.message : d.name + ' not matched';
        console.error(msg);
        errMsg.push('Failed: ' + msg);
        if (count === passData.length ) {
          return res.status(201).json({
            errMsg: errMsg,
            doneMsg: doneMsg
          });
        }
      }
    });
  });
}));

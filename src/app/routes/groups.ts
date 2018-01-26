/**
 * Route handlers for (slot) groups.
 */
import * as dbg from 'debug';
import * as express from 'express';

import * as auth from '../shared/auth';

import {
  ObjectId,
  isValidId,
} from '../shared/models';

import {
  catchAll,
  format,
  HttpStatus,
  RequestError,
  findQueryParam,
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
      let groupOwner = findQueryParam(req, 'SLOTAREA', false, false);

      let groups = await Group.find({ memberType: Slot.modelName }).exec();
      for (let group of groups) {
        if (groupOwner && group.owner !== groupOwner) {
          continue;
        }
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

// /**
//  * Compute the permissions of the current user for the specified slot.
//  *
//  * @param req HTTP Request
//  * @param slot Model
//  */
// function getPermissionsToModifySlot(req: express.Request, slot: Slot) {
//   const roles = [ 'ADM:RUNCHECK', auth.formatRole('GRP', slot.area, 'LEADER') ];
//   const assign = auth.hasAnyRole(req, roles);
//   const install = assign;
//   if (debug.enabled) {
//     debug('PERM: ASSIGN: %s (%s)', assign, roles.join(' | '));
//     debug('PERM: INSTALL: %s (%s)', assign, roles.join(' | '));
//   }
//   return {
//     assign: assign,
//     install: install,
//   };
// };

router.post('/:gname/addSlots', auth.ensureAuthenticated, catchAll(async (req, res) => {
  let passData: {id: string | undefined, name: string | undefined} = req.body.passData;
  let errMsg: string = '';
  if (!passData.id) {
    throw new RequestError('Slot to Add is not found', HttpStatus.NOT_FOUND);
  }
  // const username = auth.getUsername(req);
  // const permissions = getPermissionsToModifySlot(req, (await Slot.find({_id: passData.id}).exec())[0]);
  // if (!username || !permissions.assign) {
  //   throw new RequestError('Not permitted to add this slot', HttpStatus.FORBIDDEN);
  // }
  let group = await Group.find({name: req.params.gname}).exec();
  Slot.update({_id: passData.id, groupId: null}, {groupId: group[0]._id}, function(err,raw) {
    if(err || raw.nModified == 0) {
      let msg = err ? err.message : passData.name + ' not matched';
      console.error(msg);
      errMsg = 'Failed to add ' + passData.name + msg;
      return res.status(201).json({
          errMsg: errMsg,
          doneMsg: ''
      });
    }
    return res.status(200).json({
      errMsg: '',
      doneMsg: 'Slot ' + passData.name + 'added successfully. '
    });
  });
}));

router.post('/:gid/removeSlots', auth.ensureAuthenticated, catchAll(async (req, res) => {
  let passData: {id: string | undefined} = req.body.passData;
  let errMsg: string = '';
  if (!passData.id) {
    throw new RequestError('Slot to Add is not found', HttpStatus.NOT_FOUND);
  }
  // const username = auth.getUsername(req);
  // const permissions = getPermissionsToModifySlot(req, (await Slot.find({_id: passData.id}).exec())[0]);
  // if (!username || !permissions.assign) {
  //   throw new RequestError('Not permitted to remove this slot', HttpStatus.FORBIDDEN);
  // }
  Slot.update({ _id: passData.id, groupId: { $ne: null } }, { groupId: null }, function (err, raw) {
    if (err || raw.nModified == 0) {
      let msg = err ? err.message : passData.id + ' not matched';
      console.error(msg);
      errMsg = 'Failed to remove ' + msg;
      return res.status(201).json({
        errMsg: errMsg,
        doneMsg: ''
      });
    }
    return res.status(200).json({
      errMsg: '',
      doneMsg: 'Removed successfully'
    });
  });
}));

router.post('/slotGroups/new', catchAll(async (req, res) => {
  let passData: {name: string, owner: string, description: string | undefined, memberType: string} = req.body.passData;
  let errMsg: string = '';
  
  let alreadyExist = await Group.findOne({name: passData.name}).exec();
  if (alreadyExist) {
    throw new RequestError('This group name already exists', HttpStatus.FORBIDDEN);
  }

  await Group.create({name: passData.name, owner: passData.owner, desc: passData.description, memberType: passData.memberType}, function (err: any, raw: any) {
    if (err || raw.nModified == 0) {
      let msg = err ? err.message : passData.name + ' not matched';
      console.error(msg);
      errMsg = 'Failed to add slot group ' + msg;
      return res.status(201).json(errMsg);
    }
    return res.status(200).json(passData.name + ' added successfully');
  });
}));
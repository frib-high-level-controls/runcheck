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
  ensurePackage,
  ensureAccepts,
} from '../shared/handlers';

import {
  Slot,
} from '../models/slot';

import {
  IGroup,
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
      let safetyLevelPassed = findQueryParam(req, 'SAFETYLEVEL', false, false);
      let safetyLevel: 'NORMAL' | 'CONTROL' | 'CREDITED' | 'ESHIMPACT' | 'NONE';
      switch (safetyLevelPassed) {
        case 'NORMAL':
          safetyLevel = 'NORMAL';
          break;
        case 'CONTROL':
          safetyLevel = 'CONTROL';
          break;
        case 'CREDITED':
          safetyLevel = 'CREDITED';
          break;
        case 'ESHIMPACT':
          safetyLevel = 'ESHIMPACT';
          break;
        default:
        safetyLevel = 'NONE';
          break;
      }
      let groups = await Group.find({ memberType: Slot.modelName }).exec();
      for (let group of groups) {
        if (groupOwner && group.owner !== groupOwner) {
          continue;
        }
        if (safetyLevelPassed && group.safetyLevel !== safetyLevel) {
          continue;
        }
        rows.push({
          id: group._id,
          name: group.name,
          desc: group.desc,
          safetyLevel: group.safetyLevel,
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

  let perms = getPermissionsToModifyGroup(req, group.owner);

  const apiGroup: webapi.Group = {
    id: ObjectId(group._id).toHexString(),
    name: group.name,
    desc: group.desc,
    owner: group.owner,
    safetyLevel: group.safetyLevel,
    checklistId: group.checklistId ? group.checklistId.toHexString() : null,
    canManage: perms.assign,
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

/**
 * Compute the permissions of the current user for the specified slot.
 *
 * @param req HTTP Request
 * @param slot Model
 */
function getPermissionsToModifyGroup(req: express.Request, area: string) {
  const roles = [ 'ADM:RUNCHECK', auth.formatRole('GRP', area, 'LEADER') ];
  const assign = auth.hasAnyRole(req, roles);
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', assign, roles.join(' | '));
  }
  return {
    assign: assign,
  };
};

router.post('/slot/:id/members', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let group = await Group.findById(req.params.id).exec();
  if (!group) {
    throw new RequestError('Invalid group name', HttpStatus.NOT_FOUND);
  }

  if (group.memberType !== Slot.modelName) {
    throw new RequestError('Invalid group memberType', HttpStatus.NOT_FOUND);
  }

  let passData: {id?: string} = req.body.data;
  if (!passData.id) {
    throw new RequestError('Slot to Add is not found', HttpStatus.BAD_REQUEST);
  }

  let slot = await Slot.findById(passData.id).exec();
  if (!slot) {
    throw new RequestError('Slot to Add is not found', HttpStatus.BAD_REQUEST);
  }

  if (slot.groupId) {
    if (slot.groupId.equals(group._id)) {
      throw new RequestError('Slot is already in this group', HttpStatus.BAD_REQUEST);
    }
    throw new RequestError('Slot is in another group', HttpStatus.CONFLICT);
  }

  if (group.owner !== slot.area) {
    throw new RequestError('Slot area does not match group area', HttpStatus.BAD_REQUEST);
  }

  if (slot.safetyLevel !== group.safetyLevel) {
    throw new RequestError('Safety level does not match', HttpStatus.BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissionsToModifyGroup(req, slot.area);
  if (!username || !permissions.assign) {
    throw new RequestError('Not permitted to add this slot', HttpStatus.FORBIDDEN);
  }

  slot.groupId = group._id;
  await slot.saveWithHistory(auth.formatRole('USR', username));
  let webslot: webapi.Slot = {
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
  };
  res.status(HttpStatus.OK).json(<webapi.Pkg<webapi.Slot>>{
    data: webslot,
  });
}));

router.delete('/slot/:id/members', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let group = await Group.findById(req.params.id).exec();
  if (!group) {
    throw new RequestError('Invalid group name', HttpStatus.NOT_FOUND);
  }
  
  if (group.memberType !== Slot.modelName) {
    throw new RequestError('Invalid group memberType', HttpStatus.NOT_FOUND);
  }

  let passData: {id: string | undefined} = req.body.data;
  if (!passData.id) {
    throw new RequestError('Slot to Remove is not found', HttpStatus.NOT_FOUND);
  }

  let slot = await Slot.findById(passData.id).exec();
  if (!slot) {
    throw new RequestError('Slot to Remove is not found', HttpStatus.BAD_REQUEST);
  }

  if (!slot.groupId || !slot.groupId.equals(group._id)) {
    throw new RequestError('Slot is not a member of this group', HttpStatus.BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissionsToModifyGroup(req, slot.area);
  if (!username || !permissions.assign) {
    throw new RequestError('Not permitted to remove this slot', HttpStatus.FORBIDDEN);
  }
  slot.groupId = undefined;
  await slot.saveWithHistory(auth.formatRole('USR', username));
  res.status(HttpStatus.OK).json(<webapi.Pkg<{}>>{
    data: {},
  });
}));

router.post('/slot', auth.ensureAuthenticated, ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let passData: {name?: string, owner?: string, description?: string, safetyLevel?: string} = req.body.data;

  if (!passData.name || passData.name.trim().length < 1) {
    throw new RequestError('Invalid group name', HttpStatus.BAD_REQUEST);
  }

  if (!passData.owner || passData.owner.trim().length < 1) {
    throw new RequestError('Invalid group owner', HttpStatus.BAD_REQUEST);
  }

  let safetyLevel: 'NORMAL' | 'CONTROL' | 'CREDITED' | 'ESHIMPACT';
  switch (passData.safetyLevel) {
    case 'NORMAL':
      safetyLevel = 'NORMAL';
      break;
    case 'CONTROL':
      safetyLevel = 'CONTROL';
      break;
    case 'CREDITED':
      safetyLevel = 'CREDITED';
      break;
    case 'ESHIMPACT':
      safetyLevel = 'ESHIMPACT';
      break;
    default:
      throw new RequestError('Invalid safety level', HttpStatus.BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissionsToModifyGroup(req, passData.owner);
  if (!username || !permissions.assign) {
    throw new RequestError('Not permitted to add this slot', HttpStatus.FORBIDDEN);
  }

  let doc: IGroup = { 
    name: passData.name.trim(), 
    owner: passData.owner.trim(), 
    desc: passData.description ? passData.description.trim() : '' , 
    memberType: Slot.modelName, 
    safetyLevel: safetyLevel
  };

  let group = new Group(doc);
  group.saveWithHistory(auth.formatRole('USR', username));
  const apiGroup: webapi.Group = {
    id: ObjectId(group._id).toHexString(),
    name: group.name,
    desc: group.desc,
    owner: group.owner,
    safetyLevel: group.safetyLevel,
    checklistId: group.checklistId ? group.checklistId.toHexString() : null,
  };
  res.json(<webapi.Pkg<webapi.Group>> {
    data: apiGroup,
  });
}));
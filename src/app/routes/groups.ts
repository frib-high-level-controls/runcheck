/**
 * Route handlers for (slot) groups.
 */
import * as dbg from 'debug';
import * as express from 'express';

import * as auth from '../shared/auth';

import {
  isValidId,
  mapById,
  ObjectId,
} from '../shared/models';

import {
  catchAll,
  ensureAccepts,
  ensurePackage,
  findQueryParam,
  format,
  getHistoryUpdates,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import {
  SAFETY_LEVELS,
  SafetyLevel,
  Slot,
} from '../models/slot';

import {
  Group,
  IGroup,
} from '../models/group';

import {
  Checklist,
} from '../models/checklist';

interface RouterOptions {
  adminRoles?: string[];
}

const debug = dbg('runcheck:groups');

const CONFLICT = HttpStatus.CONFLICT;
const FORBIDDEN = HttpStatus.FORBIDDEN;
const NOT_FOUND = HttpStatus.NOT_FOUND;
const BAD_REQUEST = HttpStatus.BAD_REQUEST;

const GRP = auth.RoleScheme.GRP;
const USR = auth.RoleScheme.USR;

let adminRoles: string[] = [];

export function getAdminRoles(): string[] {
  return Array.from(adminRoles);
}

export function setAdminRoles(roles: string[]) {
  adminRoles = Array.from(roles);
}

const router = express.Router();

export function getRouter(opts?: RouterOptions): express.Router {
  if (opts) {
    if (opts.adminRoles) {
      setAdminRoles(opts.adminRoles);
    }
  }
  return router;
};


router.get('/groups/slot', catchAll(async (req, res) => {
  format(res, {
    'text/html': () => {
      res.render('slot-groups');
    },
    'application/json': async () => {
      const rows: webapi.GroupTableRow[] = [];

      let conds: { safetyLevel?: string, owner?: string, memberType: string } = { memberType: Slot.modelName };
      let ownerParam = findQueryParam(req, 'OWNER');
      if (ownerParam) {
        conds.owner = ownerParam.trim().toUpperCase();
      }
      let safetyLevelParam = findQueryParam(req, 'SAFETYLEVEL');
      if (safetyLevelParam) {
        conds.safetyLevel = safetyLevelParam.trim().toUpperCase();
      }

      const [ groups, checklists ] = await Promise.all([
        Group.find(conds).exec(),
        mapById(Checklist.find({ targetType: Group.modelName }).exec()),
      ]);
      for (let group of groups) {
        let row: webapi.GroupTableRow = {
          id: group._id,
          name: group.name,
          desc: group.desc,
          safetyLevel: group.safetyLevel,
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


router.get('/groups/slot/:name_or_id', catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Group with name or id: %s', nameOrId);

  let group: Group | null;
  if (isValidId(nameOrId)) {
    group = await Group.findById(nameOrId).exec();
  } else {
    group = await Group.findOne({ name: nameOrId.toUpperCase() });
  }

  if (!group || !group.id) {
    throw new RequestError('Group not found', NOT_FOUND);
  }

  const perms = getPermissions(req, group.owner);

  const apiGroup: webapi.Group = {
    id: ObjectId(group._id).toHexString(),
    name: group.name,
    desc: group.desc,
    owner: group.owner,
    safetyLevel: group.safetyLevel,
    checklistId: group.checklistId ? group.checklistId.toHexString() : undefined,
    canManage: perms.manage,
    canAssign: perms.assign,
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

router.get('/groups/slot/:name_or_id/history', ensureAccepts('json'), catchAll(async (req, res) => {
  const nameOrId = String(req.params.name_or_id);
  debug('Find Group with name or id: %s', nameOrId);

  let group: Group | null;
  if (isValidId(nameOrId)) {
    group = await Group.findByIdWithHistory(nameOrId);
  } else {
    group = await Group.findOneWithHistory({ name: nameOrId.toUpperCase()});
  }

  if (!group || !group.id) {
    throw new RequestError('Group not found', NOT_FOUND);
  }


  const apiUpdates: webapi.Update[] = getHistoryUpdates(group);


  const respkg: webapi.Pkg<webapi.Update[]> = {
    data: apiUpdates,
  };

  res.json(respkg);
}));


router.get('/groups/slot/:id/members', catchAll(async (req, res) => {
  const id = String(req.params.id);
  const slots = await Slot.find({ groupId: id }).exec();

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
      machineModes: Array.from(slot.machineModes),
    });
  }
  res.json(<webapi.Pkg<webapi.Slot[]>> {
    data: webSlots,
  });
}));

/**
 * Compute the permissions of the current user for the specified group.
 */
function getPermissions(req: express.Request, owner: string) {
  const ownerRole = auth.formatRole(GRP, owner, 'LEADER');
  const manageRoles = [ ownerRole ].concat(adminRoles);
  const manage = auth.hasAnyRole(req, manageRoles);
  if (debug.enabled) {
    debug('PERM: ASSIGN: %s (%s)', manage, manageRoles.join(' | '));
    debug('PERM: MANAGE: %s (%s)', manage, manageRoles.join(' | '));
  }
  return {
    manage: manage,
    assign: manage, // currently 'assign' permission same as 'manage'
  };
};

// tslint:disable:max-line-length
router.post('/groups/slot/:id/members', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let id = String(req.params.id);

  let group = await Group.findOne({ _id: id, memberType: Slot.modelName }).exec();
  if (!group) {
    throw new RequestError('Slot Group not found', NOT_FOUND);
  }

  let passData: {id?: string} = req.body.data;
  if (!passData.id) {
    throw new RequestError('Slot to add is required', BAD_REQUEST);
  }

  let slot = await Slot.findById(passData.id).exec();
  if (!slot) {
    throw new RequestError('Slot to add is not found', BAD_REQUEST);
  }

  if (slot.groupId) {
    if (slot.groupId.equals(group._id)) {
      throw new RequestError('Slot is already in this group', BAD_REQUEST);
    }
    throw new RequestError('Slot is in another group', CONFLICT);
  }

  if (group.owner !== slot.area) {
    throw new RequestError('Slot area does not match group', BAD_REQUEST);
  }

  if (slot.safetyLevel !== group.safetyLevel) {
    throw new RequestError('Slot safety level does not match group', BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissions(req, slot.area);
  if (!username || !permissions.manage) {
    throw new RequestError('Not permitted to add this slot', FORBIDDEN);
  }

  slot.groupId = group._id;
  await slot.saveWithHistory(auth.formatRole(USR, username));

  let webslot: webapi.Slot = {
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
    machineModes: Array.from(slot.machineModes),
  };

  res.json(<webapi.Pkg<webapi.Slot>> {
    data: webslot,
  });
}));

router.delete('/groups/slot/:id/members', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let id = String(req.params.id);

  let group = await Group.findById({ _id: id, memberType: Slot.modelName }).exec();
  if (!group) {
    throw new RequestError('Slot Group not found', NOT_FOUND);
  }

  let passData: {id?: string} = req.body.data;
  if (!passData.id) {
    throw new RequestError('Slot to remove is required', BAD_REQUEST);
  }

  let slot = await Slot.findById(passData.id).exec();
  if (!slot) {
    throw new RequestError('Slot to remove is not found', BAD_REQUEST);
  }

  if (!slot.groupId || !slot.groupId.equals(group._id)) {
    throw new RequestError('Slot is not a member of this group', BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissions(req, slot.area);
  if (!username || !permissions.manage) {
    throw new RequestError('Not permitted to remove this slot', FORBIDDEN);
  }

  slot.groupId = undefined;
  await slot.saveWithHistory(auth.formatRole(USR, username));

  res.json(<webapi.Pkg<{}>> {
    data: {},
  });
}));

router.post('/groups/slot', auth.ensureAuthc(), ensurePackage(), ensureAccepts('json'), catchAll(async (req, res) => {
  let passData: {name?: string, owner?: string, desc?: string, safetyLevel?: string} = req.body.data;
  if (debug.enabled) {
    debug('Create slot group with data: %s', JSON.stringify(passData));
  }

  if (!passData.name || passData.name.trim().length < 1) {
    throw new RequestError('Slot Group name is required', BAD_REQUEST);
  }

  if (!passData.owner || passData.owner.trim().length < 1) {
    throw new RequestError('Slot Group owner is required', BAD_REQUEST);
  }

  if (!passData.safetyLevel) {
    throw new RequestError('Slot Group safety level is required', BAD_REQUEST);
  }

  passData.safetyLevel = passData.safetyLevel.trim().toUpperCase();
  let safetyLevel: SafetyLevel | undefined;
  for (let SAFETY_LEVEL of SAFETY_LEVELS) {
    if (passData.safetyLevel === SAFETY_LEVEL) {
      safetyLevel = SAFETY_LEVEL;
      break;
    }
  }
  if (!safetyLevel) {
    throw new RequestError(`Slot Group safety level is invalid: ${passData.safetyLevel}`, BAD_REQUEST);
  }

  const username = auth.getUsername(req);
  const permissions = getPermissions(req, passData.owner);
  if (!username || !permissions.manage) {
    throw new RequestError('Not permitted to add this slot', FORBIDDEN);
  }

  let doc: IGroup = {
    name: passData.name.trim(),
    owner: passData.owner.trim(),
    desc: passData.desc ? passData.desc.trim() : '' ,
    memberType: Slot.modelName,
    safetyLevel: safetyLevel,
  };

  let group = new Group(doc);
  group.saveWithHistory(auth.formatRole(USR, username));

  const apiGroup: webapi.Group = {
    id: ObjectId(group._id).toHexString(),
    name: group.name,
    desc: group.desc,
    owner: group.owner,
    safetyLevel: group.safetyLevel,
    checklistId: group.checklistId ? group.checklistId.toHexString() : undefined,
  };

  res.json(<webapi.Pkg<webapi.Group>> {
    data: apiGroup,
  });
}));

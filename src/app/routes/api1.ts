/**
 * RESTful API (partially) compatible with CCDB v1
 */

import * as express from 'express';

import * as models from '../shared/models';

import {
  catchAll,
  ensureAccepts,
  HttpStatus,
  RequestError,
} from '../shared/handlers';

import { Checklist } from '../models/checklist';
import { Group } from '../models/group';
import { Slot } from '../models/slot';

interface ReportStatus {
  slot: string;
  subSlots: number;
  installedSlots: number;
  approvedSlots: 0;
  checklistApprovedSlots: number;
}

const INTERNAL_SERVER_ERROR = HttpStatus.INTERNAL_SERVER_ERROR;

export const router = express.Router();

router.get('/api/v1/report/status', ensureAccepts('json'), catchAll(async (req, res) => {
  let statuses = new Map<string, ReportStatus>();

  const [ slots, groups, checklists ] = await Promise.all([
    Slot.find().exec(),
    models.mapById(Group.find({ memberType: Slot.modelName }).exec()),
    models.mapById(Checklist.find({ targetType: { $in: [ Slot.modelName, Group.modelName ] }}).exec()),
  ]);
  for (let slot of slots) {
    // Assume slot names follow FRIB standard format
    // {system}_{subsystem}:{device}_{qualifier}:{signal}_{domain}
    // (Details: https://controls.frib.msu.edu/names/)
    let system = slot.name.split('_')[0];

    let status = statuses.get(system);
    if (!status) {
      status = {
        slot: system,
        subSlots: 0,
        installedSlots: 0,
        approvedSlots: 0,
        checklistApprovedSlots: 0,
      };
      statuses.set(system, status);
    }
    status.subSlots += 1;

    if (slot.installDeviceId) {
      status.installedSlots += 1;
    }

    if (slot.groupId) {
      let group = groups.get(slot.groupId.toHexString());
      if (!group) {
        throw new RequestError(`Slot group not found: ${slot.groupId}`, INTERNAL_SERVER_ERROR);
      }
      if (group.checklistId) {
        const checklist = checklists.get(group.checklistId.toHexString());
        if (checklist && checklist.approved) {
          status.checklistApprovedSlots += 1;
        }
      }
    } else if (slot.checklistId) {
      const checklist = checklists.get(slot.checklistId.toHexString());
      if (checklist && checklist.approved) {
        status.checklistApprovedSlots += 1;
      }
    }
  }
  res.json(Array.from(statuses.values()));
}));

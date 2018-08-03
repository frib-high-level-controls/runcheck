/**
 * Utilities for working with Checklists
 */

import {
  ObjectId,
} from '../shared/models';

import {
  IGroup,
} from '../models/group';

import {
  IChecklist,
} from '../models/checklist';

export interface ITarget {
  // device & slot & group
  name: string;
  desc: string;
  checklistId?: ObjectId;
  // device only
  dept?: string;
  // slot only
  area?: string;
  groupId?: ObjectId;
  // group only
  owner?: string;
  memberType?: string;
}

type Mapping<T> = Map<string, T>;

/**
 * Resolve the correct checklist for the given target (ie device/slot/group).
 */
// tslint:disable:max-line-length
export function resolveChecklist<C extends IChecklist>(target: ITarget, checklists: Mapping<C>, groups: Mapping<IGroup>): C | undefined {

  if (target.groupId) {
    const group = groups.get(target.groupId.toHexString());
    if (!group) {
      throw new Error(`Group for Target (${target.name}) not found: ${target.groupId}`);
    }
    if (group.checklistId) {
      const checklist = checklists.get(group.checklistId.toHexString());
      if (!checklist) {
        throw new Error(`Checklist for Group (${group.name}) not found: ${group.checklistId}`);
      }
      return checklist;
    }
  }

  if (target.checklistId) {
    const checklist = checklists.get(target.checklistId.toHexString());
    if (!checklist) {
      throw new Error(`Checklist for Target (${target.name}) not found: ${target.groupId}`);
    }
    return checklist;
  }
}

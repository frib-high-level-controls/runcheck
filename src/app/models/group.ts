/**
 * Model to group slots (or possibly devices).
 */
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

import { Checklist } from './checklist';

import {
  SAFETY_LEVELS,
  SafetyLevel,
} from './slot';

type ObjectId = mongoose.Types.ObjectId;

export interface IGroup {
  name: string;
  desc: string;
  owner: string;
  memberType: string;
  safetyLevel?: SafetyLevel;
  checklistId?: ObjectId;
};

export interface Group extends IGroup, history.Document<Group> {
  // no additional methods
};

// Needed to stop cyclical dependency
// between Slot and Device and Group models.
export const MODEL_NAME = 'Group';

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const groupSchema = new Schema({
  name: {
    type: String,
    // index: true,
    // unique: true,
    required: true,
  },
  desc: {
    type: String,
    default: '',
    // required: true, // Requires non-empty string!
    // Use the following less strict replacement.
    validate: (v: any) => (typeof v === 'string'),
  },
  owner: {
    type: String,
    required: true,
  },
  memberType: {
    type: String,
    required: true,
  },
  checklistId: {
    type: ObjectId,
    ref: Checklist.modelName,
    required: false,
  },
  safetyLevel: {
    type: String,
    enum: SAFETY_LEVELS,
    required: false,
  },
});

history.addHistory(groupSchema, {
  watchAll: true,
});

export const Group = history.model<Group>(MODEL_NAME, groupSchema);

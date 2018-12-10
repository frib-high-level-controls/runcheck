/**
 * Model to group slots (or possibly devices).
 */
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

import { Checklist } from './checklist';

import {
  GROUP_MODEL_NAME,
  // SLOT_MODEL_NAME,
} from './common';

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
    // TODO: Add this constraint when there
    // is sufficient time for testing.
    // enum: [ SLOT_MODEL_NAME ],
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

export const Group = history.model<Group>(GROUP_MODEL_NAME, groupSchema);

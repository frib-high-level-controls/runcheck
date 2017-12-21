/**
 * Model to group slots (or possibly devices).
 */
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

import { Checklist } from './checklist';

type ObjectId = mongoose.Types.ObjectId;

export interface IGroup {
  name: string;
  desc: string;
  memberType: string;
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
    //index: true,
    //unique: true,
    required: true,
  },
  desc: {
    type: String,
    default: '',
  },
  //area: String,
  //description: String,
  // memberIds: {
  //   type: [ObjectId],
  //   required: true,
  // },
  memberType: {
    type: String,
    required: true,
  },

  checklistId: {
    type: ObjectId,
    ref: Checklist.modelName,
    required: false,
  },
  //ARRChecklist: Mixed,
  //DRRChecklist: Mixed,
  //createdBy: String,
  //createdOn: {
  //  type: Date,
  //  default: Date.now
  //}
});

history.addHistory(groupSchema, {
  watchAll: true,
});

export const Group = history.model<Group>('Group', groupSchema);

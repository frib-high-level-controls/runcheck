/**
 * Model to represent a checklist (for device or slot).
 */
import * as dbg from 'debug';
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

type ObjectId = mongoose.Types.ObjectId;

export interface IChecklistSubject {
  checklistId: ObjectId | null;
  ChecklistType: 'device-default' | 'slot-default';
  name: string;
  order: number;
  final: boolean;
  required: boolean;
  mandatory: boolean;
  assignees: string[];
};

export interface ChecklistSubject extends IChecklistSubject, history.Document<ChecklistSubject> {
  applyCfg(cfg: ChecklistConfig): void;
};

export interface IChecklistConfig extends history.Document<ChecklistConfig> {
  checklistId: ObjectId;
  subjectId: ObjectId;
  name?: string;
  required?: boolean;
  assignees?: string[];
}

export interface ChecklistConfig extends IChecklistConfig, history.Document<ChecklistConfig> {
  // no additional methods
};

export interface IChecklistStatus {
  checklistId: ObjectId;
  subjectId: ObjectId;
  value: string;
  comment: string;
  inputOn: Date;
  inputBy: string;
};

export interface ChecklistStatus extends IChecklistStatus, history.Document<ChecklistStatus> {
  // no additional methods
};

export interface IChecklist {
  checklistType: 'device-default' | 'slot-default';
  targetType: string;
  targetId: ObjectId;
};

export interface Checklist extends IChecklist, mongoose.Document {
  // no additional methods
};

const debug = dbg('runcheck:checklist');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

export const CHECKLIST_VALUES = ['N', 'Y', 'YC'];

export const CHECKLIST_TYPES = ['device-default', 'slot-default'];


// A checklist is a list of responses for various subjects:
//  targetType: the type of the object to which this checklist belongs
//  targetId: the object to which this checklist belongs
//  type: the type of this checklist
const checklistSchema = new Schema({
  checklistType: {
    type: String,
    required: true,
    enum: CHECKLIST_TYPES,
  },
  targetType: {
    type: String,
    required: true,
  },
  targetId: {
    type: ObjectId,
    refPath: 'targetType',
    required: true,
  },
  // Consider adding checklist completion information from device
  // , checkedValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0
  // },
  // totalValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0
  // }
});


// checklist.plugin(addHistory, {
//   fieldsToWatch: ['items']
// });

export const Checklist = mongoose.model<Checklist>('Checklist', checklistSchema);


// A checklistSubject represents single item of a checklist:
//   type: the checklist type to which this item belongs
//   subject: name of the subject of this checklist item
//   checklist: the specific checklist to which this item belongs
//   order: the order in which this item should be rendered
//   assignee: the roles to which this item is assigned
//   required: indicates if this item must be completed
//   mandatory: indicates if this item must be required
//   final: indicates of this item finalizes the checklist
const checklistSubjectSchema = new Schema({
  checklistId: {
    type: ObjectId,
    ref: Checklist.modelName,
    default: null,
  },
  checklistType: {
    type: String,
    required: true,
    enum: CHECKLIST_TYPES,
  },
  name: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  assignees: {
    type: [String],
    required: true,
  },
  required: {
    type: Boolean,
    required: true,
  },
  mandatory: {
    type: Boolean,
    required: true,
  },
  final: {
    type: Boolean,
    required: true,
  },
});


checklistSubjectSchema.statics.applyCfg = function(sub: ChecklistSubject, cfg: ChecklistConfig) {
  if (sub && cfg) {
    if (typeof cfg.name === 'string') {
      sub.name = cfg.name;
    }
    if (Array.isArray(cfg.assignees) && (cfg.assignees.length > 0)) {
      sub.assignees = Array.from(cfg.assignees);
    }
    if (typeof cfg.required === 'boolean') {
      sub.required = cfg.required;
    }
    if (cfg.history.updatedAt > sub.history.updatedAt) {
      sub.history.updatedAt = cfg.history.updatedAt;
      sub.history.updatedBy = cfg.history.updatedBy;
    }
    if (cfg.history && Array.isArray(cfg.history.updateIds)) {
      if (sub.history && Array.isArray(sub.history.updateIds)) {
        sub.history.updateIds = sub.history.updateIds.concat(cfg.history.updateIds);
      } else {
        sub.history.updateIds = Array.from(cfg.history.updateIds);
      }
    }
    if (Array.isArray(cfg.history.updates)) {
      if (Array.isArray(sub.history.updates)) {
        sub.history.updates = sub.history.updates.concat(cfg.history.updates);
      } else {
        sub.history.updates = Array.from(cfg.history.updates);
      }
    }
  }
  return sub;
};

checklistSubjectSchema.methods.applyCfg = function(cfg: ChecklistConfig) {
  return checklistSubjectSchema.statics.applyCfg(this, cfg);
};

history.addHistory(checklistSubjectSchema, {
  pathsToWatch: [
    'name',
    'assignee',
    'mandatory',
    'required',
  ],
});

export const ChecklistSubject = history.model<ChecklistSubject>('ChecklistSubject', checklistSubjectSchema);



// A checklistConfig is configuration for a checklist subject:
//   checklist: the checklist to which this configuration belongs
//   subjectId: the checklist item to which this configuration applies
//   name: alternative subject to override the item
//   assignee: user id of person required to respond to this item
//   required: indicate if the item must have a response
const checklistConfigSchema = new Schema({
  checklistId: {
    type: ObjectId,
    required: true,
  },
  subjectId: {
    type: ObjectId,
    ref: ChecklistSubject.modelName,
    required: true,
  },
  name: {
    type: String,
    required: false,
  },
  assignee: {
    type: [String],
    required: false,
    // normal default is `[]`
    default: undefined,
  },
  required: {
    type: Boolean,
    required: false,
  },
});

history.addHistory(checklistConfigSchema, {
  pathsToWatch: [
    'name',
    'assignee',
    'required',
  ],
});

export const ChecklistConfig = history.model<ChecklistConfig>('ChecklistConfig', checklistConfigSchema);




// A checklistStatus is the response for a checklist item:
//  checklistId: the checklist to which this response belongs
//  subjectId: the checklist item to which this response applies
//  value: the value of the input
//  comment: extra information
//  inputOn: date when the input was submitted
//  inputBy: user id of the persion who submitted the input
const checklistStatusSchema = new Schema({
  checklistId: {
    type: ObjectId,
    required: true,
  },
  subjectId: {
    type: ObjectId,
    ref: ChecklistSubject.modelName,
    required: true,
  },
  value: {
    type: String,
    required: true,
    enum: CHECKLIST_VALUES,
  },
  comment: {
    type: String,
    default: '',
  },
  inputOn: {
    type: Date,
    required: true,
  },
  inputBy: {
    type: String,
    required: true,
  },
});

history.addHistory(checklistStatusSchema, {
  pathsToWatch: [
    'value',
    'comment',
    'inputOn',
    'inputBy',
  ],
});

export const ChecklistStatus = history.model<ChecklistStatus>('ChecklistStatus', checklistStatusSchema);

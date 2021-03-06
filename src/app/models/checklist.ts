/**
 * Model to represent a checklist (for device or slot).
 */
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

type ObjectId = mongoose.Types.ObjectId;

export enum ChecklistValue {
  N = 'N',
  Y = 'Y',
  YC = 'YC',
}

export enum ChecklistType {
  DEVICE_DEFAULT = 'DEVICE_DEFAULT',
  SLOT_DEFAULT = 'SLOT_DEFAULT',
  SLOT_SAFETY = 'SLOT_SAFETY',
}

export interface IChecklistSubject {
  checklistId?: ObjectId;
  checklistType: ChecklistType;
  name: string;
  desc: string;
  order: number;
  final: boolean;
  primary: boolean;
  required: boolean;
  mandatory: boolean;
  assignees: string[];
}

export interface ChecklistSubject extends IChecklistSubject, history.Document<ChecklistSubject> {
  applyCfg(cfg: ChecklistConfig): void;
  isCustom(): boolean;
}

export interface IChecklistConfig {
  checklistId: ObjectId;
  subjectName: string;
  required?: boolean;
  assignees?: string[];
}

export interface ChecklistConfig extends IChecklistConfig, history.Document<ChecklistConfig> {
  // no additional methods
}

export interface IChecklistStatus {
  checklistId: ObjectId;
  subjectName: string;
  value: string;
  comment: string;
  inputAt: Date;
  inputBy: string;
}

export interface ChecklistStatus extends IChecklistStatus, history.Document<ChecklistStatus> {
  isApproved(withComment?: boolean): boolean;
}

export interface IChecklist {
  checklistType: ChecklistType;
  targetType: string;
  targetId: ObjectId;
  approved: boolean;
  checked: number;
  total: number;
}

export interface Checklist extends IChecklist, mongoose.Document {
  // no additional methods
}


const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

export const CHECKLIST_VALUES: ChecklistValue[] = [
  ChecklistValue.N,
  ChecklistValue.Y,
  ChecklistValue.YC,
];

export const CHECKLIST_TYPES: ChecklistType[] = [
  ChecklistType.DEVICE_DEFAULT,
  ChecklistType.SLOT_DEFAULT,
  ChecklistType.SLOT_SAFETY,
];

export function isChecklistValueValid(value?: string): boolean {
  return CHECKLIST_VALUES.reduce((p, v) => (p || (v === value)), false);
}

export function isChecklistValueApproved(value?: string, withComment?: boolean): boolean {
  return (value === ChecklistValue.YC) || (!withComment && (value === ChecklistValue.Y));
}

/**
 * Summarize the status of the checklist, including final approval.
 */
// tslint:disable:max-line-length
export function isChecklistApproved(checklist: Checklist, subjects: ChecklistSubject[], configs: ChecklistConfig[], statuses: ChecklistStatus[], apply?: boolean): boolean {
  let total = 0;
  let checked = 0;
  let finalsTotal = 0;
  let finalsChecked = 0;

  for (const subject of subjects) {
    if (checklist.checklistType === subject.checklistType) {

      let config: ChecklistConfig | undefined;
      for (const c of configs) {
        if (checklist._id.equals(c.checklistId) && (subject.name === c.subjectName)) {
          config = c;
          break;
        }
      }

      let status: ChecklistStatus | undefined;
      for (const s of statuses) {
        if (checklist._id.equals(s.checklistId) && (subject.name === s.subjectName)) {
          status = s;
          break;
        }
      }

      // Careful to check the the config 'required' property is actually defined!
      if (subject.mandatory ||
          ((!config || config.required === undefined) && subject.required) ||
            ((config && config.required !== undefined) && config.required)) {
        total += 1;
        if (subject.final) {
          finalsTotal += 1;
        }
        if (status && isChecklistValueApproved(status.value)) {
          checked += 1;
          if (subject.final) {
            finalsChecked += 1;
          }
        }
      }
    }
  }
  const approved = (finalsChecked > 0) && (finalsChecked === finalsTotal);

  if (apply) {
    checklist.approved = approved;
    checklist.checked = checked;
    checklist.total = total;
  }

  return approved;
}

// A checklist is a list of responses for various subjects:
//  targetType: the type of the object to which this checklist belongs
//  targetId: the object to which this checklist belongs
//  type: the type of this checklist
//  checked: the number of subjects that are approved
//  total:  the total number of subjects for this checklist
//  approved: the approval status of the checklist
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
  approved: {
    type: Boolean,
    default: false,
    required: true,
  },
  checked: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
  total: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
});


// checklist.plugin(addHistory, {
//   fieldsToWatch: ['items']
// });

export const Checklist = mongoose.model<Checklist>('Checklist', checklistSchema);


// A checklistSubject represents single item of a checklist:
//   type: the checklist type to which this subject belongs
//   name: name of the subject
//   desc: description of the subject
//   checklistId: the specific checklist to which this subject belongs
//   order: the order in which this item should be rendered
//   assignees: the roles to which this subject is assigned
//   required: indicates if this subject must be completed
//   mandatory: indicates if this subject must be required
//   primary: indicates if this subject is the primary for the checklist
//   final: indicates of this item finalizes the checklist
const checklistSubjectSchema = new Schema({
  checklistId: {
    type: ObjectId,
    ref: Checklist.modelName,
    required: false,
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
  desc: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    default: 0,
    require: true,
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
  primary: {
    type: Boolean,
    required: true,
  },
  final: {
    type: Boolean,
    required: true,
  },
});

checklistSubjectSchema.methods.applyCfg = function(this: ChecklistSubject, cfg?: ChecklistConfig): void {
  if (cfg) {
    if (Array.isArray(cfg.assignees) && (cfg.assignees.length > 0)) {
      this.assignees = Array.from(cfg.assignees);
    }
    if (typeof cfg.required === 'boolean') {
      this.required = cfg.required;
    }
    if (cfg.history.updatedAt) {
      if (!this.history.updatedAt || cfg.history.updatedAt > this.history.updatedAt) {
        this.history.updatedAt = cfg.history.updatedAt;
        this.history.updatedBy = cfg.history.updatedBy;
      }
    }
    if (cfg.history && Array.isArray(cfg.history.updateIds)) {
      if (this.history && Array.isArray(this.history.updateIds)) {
        this.history.updateIds = this.history.updateIds.concat(cfg.history.updateIds);
      } else {
        this.history.updateIds = Array.from(cfg.history.updateIds);
      }
    }
    if (Array.isArray(cfg.history.updates)) {
      if (Array.isArray(this.history.updates)) {
        this.history.updates = this.history.updates.concat(cfg.history.updates);
      } else {
        this.history.updates = Array.from(cfg.history.updates);
      }
    }
  }
};

checklistSubjectSchema.methods.isCustom = function(this: ChecklistSubject): boolean {
  return (this.checklistId !== undefined);
};

history.addHistory(checklistSubjectSchema, {
  watchAll: true,
});

export const ChecklistSubject = history.model<ChecklistSubject>('ChecklistSubject', checklistSubjectSchema);



// A checklistConfig is configuration for a checklist subject:
//   checklist: the checklist to which this configuration belongs
//   subjectName: the checklist item to which this configuration applies
//   assignee: user id of person required to respond to this item
//   required: indicate if the item must have a response
const checklistConfigSchema = new Schema({
  checklistId: {
    type: ObjectId,
    required: true,
  },
  subjectName: {
    type: String,
    required: true,
  },
  assignees: {
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
  watchAll: true,
});

export const ChecklistConfig = history.model<ChecklistConfig>('ChecklistConfig', checklistConfigSchema);




// A checklistStatus is the response for a checklist item:
//  checklistId: the checklist to which this response belongs
//  subjectName: the checklist item to which this response applies
//  value: the value of the input
//  comment: extra information
//  inputOn: date when the input was submitted
//  inputBy: user id of the persion who submitted the input
const checklistStatusSchema = new Schema({
  checklistId: {
    type: ObjectId,
    required: true,
  },
  subjectName: {
    type: String,
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
    // required: true, // Requires non-empty string!
    // Use the following less strict replacement.
    validate: (v: any) => (typeof v === 'string'),
  },
  inputAt: {
    type: Date,
    required: true,
  },
  inputBy: {
    type: String,
    required: true,
  },
});

checklistStatusSchema.methods.isApproved = function(this: ChecklistStatus, withComment?: boolean): boolean {
  return isChecklistValueApproved(this.value, withComment);
};

history.addHistory(checklistStatusSchema, {
  watchAll: true,
});

export const ChecklistStatus = history.model<ChecklistStatus>('ChecklistStatus', checklistStatusSchema);

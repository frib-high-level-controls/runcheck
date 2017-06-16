/**
 * Model to represent a checklist (for device or slot).
 */
import mongoose = require('mongoose');
import debugging = require('debug');

import history = require('./history');

type ObjectId = mongoose.Types.ObjectId;

type Document = mongoose.Document;

type DocumentWithHistory<T extends DocumentWithHistory<T>> = history.DocumentWithHistory<T>;

export interface ChecklistItem extends DocumentWithHistory<ChecklistItem> {
  type: 'device' | 'beamline-slot' | 'safety-slot';
  subject: string;
  checklist: ObjectId;
  order: number;
  assignee: string;
  required: boolean;
  mandatory: boolean;
  final: boolean;
  applyCfg(cfg: ChecklistItemCfg): void;
};

export interface ChecklistItemCfg extends DocumentWithHistory<ChecklistItemCfg> {
  checklist: ObjectId;
  item: ObjectId;
  subject?: string;
  assignee?: string;
  required?: boolean;
}

export interface ChecklistItemData extends DocumentWithHistory<ChecklistItemData> {
  checklist: ObjectId;
  item: ObjectId;
  value: string;
  comment: string;
  inputOn: Date;
  inputBy: string;
};

export interface Checklist extends Document {
  target: ObjectId;
  type: 'device' | 'beamline-slot' | 'safety-slot';
}


const debug = debugging('runcheck:checklist');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

export const checklistValues = ['N', 'Y', 'YC'];

export const checklistTypes = [ 'device', 'beamline-slot', 'safety-slot' ];


// A checklistItem represents single item of a checklist:
//   type: the checklist type to which this item belongs
//   subject: name of the subject of this checklist item
//   checklist: the specific checklist to which this item belongs
//   order: the order in which this item should be rendered
//   assignee: the role to which this item is assigned
//   required: indicates if this item must be completed
//   mandatory: indicates if this item must be required
//   final: indicates of this item finalizes the checklist
const checklistItemSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: checklistTypes,
  },
  subject: {
    type: String,
    required: true,
  },
  checklist: {
    type: ObjectId,
    default: null,
  },
  order: {
    type: Number,
    default: 0,
  },
  assignee: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: true,
  },
  mandatory: {
    type: Boolean,
    default: false,
  },
  final: {
    type: Boolean,
    default: false,
  },
});


checklistItemSchema.statics.applyCfg = function(item: ChecklistItem, cfg: ChecklistItemCfg) {
  if (item && cfg) {
    if (typeof cfg.subject === 'string') {
      item.subject = cfg.subject;
    }
    if (typeof cfg.assignee === 'string') {
      item.assignee = cfg.assignee;
    }
    if (typeof cfg.required === 'boolean') {
      item.required = cfg.required;
    }
    if (Array.isArray(cfg.__updates)) {
      if (item.__updates) {
        item.__updates = (<ObjectId[]> item.__updates).concat(<ObjectId[]> cfg.__updates);
      } else {
        item.__updates =  (<ObjectId[]> cfg.__updates).slice();
      }
    }
  }
  return item;
};

checklistItemSchema.methods.applyCfg = function(cfg: ChecklistItemCfg) {
  return checklistItemSchema.statics.applyCfg(this, cfg);
};

checklistItemSchema.plugin(history.addHistory, {
  fieldsToWatch: ['subject'],
});

export const ChecklistItem = mongoose.model<ChecklistItem>('ChecklistItem', checklistItemSchema);



// A checklistItemCfg is configuration for a checklist item.
//   checklist: the checklist to which this configuration belongs
//   item: the checklist item to which this configuration applies
//   subject: alternative subject to override the item
//   assignee: user id of person required to respond to this item
//   required: indicate if the item must have a response
const checklistItemCfgSchema = new Schema({
  checklist: {
    type: ObjectId,
    required: true,
  },
  item: {
    type: ObjectId,
    required: true,
  },
  subject: {
    type: String,
    default: null,
  },
  assignee: {
    type: String,
    default: null,
  },
  required: {
    type: Boolean,
    default: null,
  },
});

checklistItemCfgSchema.plugin(history.addHistory, {
  fieldsToWatch: ['subject', 'assignee', 'required' ],
});

export const ChecklistItemCfg = mongoose.model<ChecklistItemCfg>('ChecklistItemCfg', checklistItemCfgSchema);




// A checklistItemData is the response for a checklist item.
//  checklist: the checklist to which this response belongs
//  item: the checklist item to which this response applies
//  value: the value of the input
//  comment: extra information
//  inputOn: date when the input was submitted
//  inputBy: user id of the persion who submitted the input
const checklistItemDataSchema = new Schema({
  checklist: {
    type: ObjectId,
    required: true,
  },
  item: {
    type: ObjectId,
    required: true,
  },
  value: {
    type: String,
    required: true,
    enum: checklistValues,
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

checklistItemDataSchema.plugin(history.addHistory, {
  fieldsToWatch: ['value', 'comment']
});

export const ChecklistItemData = mongoose.model<ChecklistItemData>('ChecklistItemData', checklistItemDataSchema);



// A checklist is a list of responses for various subjects
//  target: the object to which this checklist belongs
//  type: the type of this checklist
const checklistSchema = new Schema({
  target: {
    type: ObjectId,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: checklistTypes,
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

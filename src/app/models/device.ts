/**
 * Model to represent a physical entity.
 */
import * as mongoose from 'mongoose';

import { Checklist } from './checklist';
import { MODEL_NAME as SLOT_MODEL_NAME } from './slot';

import * as history from  '../shared/history';

type ObjectId = mongoose.Types.ObjectId;

export interface IDevice {
  name: string;
  desc: string;
  dept: string;
  deviceType: string;
  checklistId?: ObjectId;
  installSlotId?: ObjectId;
  installSlotBy?: string;
  installSlotOn?: Date;
};

export interface Device extends IDevice, history.Document<Device> {
  // no additional methods
};

// Needed to stop cyclical dependency
// between Slot and Device and Group models.
export const MODEL_NAME = 'Device';

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

// Device represents a physical entity
//   name: unique machine readable name
//   desc: descriptive human readable name
//   dept: associated department
//   deviceType: standard device type name
//   checklistId: associated checklist (optional)
//   installSlotId: the slot in which this device is installed
//   installSlotOn: the date when this device was installed or uninstalled
//   installSlotBy: the name of the person or process that installed or uninstalled
const deviceSchema = new Schema({
  name: {
    type: String,
    index: true,
    unique: true,
    required: true,
    uppercase: true,
    trim: true,
  },
  desc: {
    type: String,
    default: '',
    // required: true, // Requires non-empty string!
    // Use the following less strict replacement.
    validate: (v: any) => (typeof v === 'string'),
  },
  dept: {
    type: String,
    required: true,
  },
  deviceType: {
    type: String,
    required: true,
  },
  checklistId: {
    type: ObjectId,
    ref: Checklist.modelName,
    required: false,
  },
  installSlotId: {
    type: ObjectId,
    required: false,
    ref: SLOT_MODEL_NAME,
  },
  installSlotBy: {
    type: String,
    required: false,
  },
  installSlotOn: {
    type: Date,
    required: false,
  },
});

deviceSchema.plugin(history.addHistory, {
  watchAll: true,
});

export const Device = history.model<Device>(MODEL_NAME, deviceSchema);

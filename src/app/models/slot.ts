/**
 * Model to represent a logical entity.
 */
import * as mongoose from 'mongoose';

import * as history from '../shared/history';

import { Checklist } from './checklist';

import {
  DEVICE_MODEL_NAME,
  GROUP_MODEL_NAME,
  SLOT_MODEL_NAME,
} from './common';

type ObjectId = mongoose.Types.ObjectId;

export enum CareLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
};

export enum SafetyLevel {
  NONE = 'NONE',
  CONTROL = 'CONTROL',
  CREDITED = 'CREDITED',
  CONTROL_ESH = 'CONTROL_ESH',
  CREDITED_ESH = 'CREDITED_ESH',
  CREDITED_PPS = 'CREDITED_PPS',
};

export interface ISlot {
  name: string;
  desc: string;
  area: string;
  deviceType: string;
  checklistId?: ObjectId;
  groupId?: ObjectId;
  careLevel: CareLevel;
  safetyLevel: SafetyLevel;
  arr: string;
  drr: string;
  installDeviceId?: ObjectId;
  installDeviceBy?: string;
  installDeviceOn?: Date;
  machineModes: string[];
};

export interface Slot extends ISlot, history.Document<Slot> {
  // no additional methods
};

export const CARE_LEVELS: CareLevel[] = [
  CareLevel.LOW,
  CareLevel.MEDIUM,
  CareLevel.HIGH,
];

export const SAFETY_LEVELS: SafetyLevel[] = [
  SafetyLevel.NONE,
  SafetyLevel.CONTROL,
  SafetyLevel.CREDITED,
  SafetyLevel.CONTROL_ESH,
  SafetyLevel.CREDITED_ESH,
  SafetyLevel.CREDITED_PPS,
];

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

/**
 * Slot represents a logical entity
 *   name: unique machine readable name
 *   desc: descriptive human readable name
 *   area: associated area
 *   deviceType: standard device type name
 *   checklistId: associated checklist (optional)
 *   groupId: associated slot group (optional)
 *   careLevel: the level of care
 *   safetyLevel: the level of safety
 *   arr: associated Accelerator Readiness Review (ie ARR0X)
 *   drr: associated Device Readinewss Review (ie DRR0X-0Y)
 *   installDeviceId: the device that is installed
 *   installDeviceOn: the date when this device was installed or uninstalled
 *   installDecieBy: the name of the person or process that installed or uninstalled
 */
const slotSchema = new Schema({
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
  area:  {
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
  groupId: {
    type: ObjectId,
    ref: GROUP_MODEL_NAME,
    required: false,
  },
  careLevel: {
    type: String,
    default: CARE_LEVELS[0],
    enum: CARE_LEVELS,
  },
  safetyLevel: {
    type: String,
    default: SAFETY_LEVELS[0],
    enum: SAFETY_LEVELS,
  },
  arr: {
    type: String,
    required: true,
  },
  drr: {
    type: String,
    required: true,
  },
  installDeviceId: {
    type: ObjectId,
    ref: DEVICE_MODEL_NAME,
    required: false,
  },
  installDeviceBy: {
    type: String,
    required: false,
  },
  installDeviceOn: {
    type: Date,
    required: false,
  },
  machineModes: {
    type: [String],
    // required: true, // Requires non-empty array!
    // Use the following less strict replacement.
    validate: (v: any) => (Array.isArray(v)),
  },
});

history.addHistory(slotSchema, {
  watchAll: true,
});

export const Slot = history.model<Slot>(SLOT_MODEL_NAME, slotSchema);

/**
 * Model to represent a logical entity.
 */
import * as mongoose from 'mongoose';

import { Checklist } from './checklist';
import { MODEL_NAME as DEVICE_MODEL_NAME } from './device';
import { Group } from './group';

import * as history from '../shared/history';

type ObjectId = mongoose.Types.ObjectId;

export type CareLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SafetyLevel = 'NORMAL' | 'CONTROL' | 'CREDITED' | 'ESHIMPACT';

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
};

export interface Slot extends ISlot, history.Document<Slot> {
  // no additional methods
};

// Needed to stop cyclical dependency
// between Slot and Device models.
export const MODEL_NAME = 'Slot';

export const CARE_LEVELS = [ 'LOW', 'MEDIUM', 'HIGH' ];

export const SAFETY_LEVELS = [ 'NORMAL', 'CONTROL', 'CREDITED', 'ESHIMPACT' ];

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
  //system: String,
  //subsystem: String,
  //deviceNaming: String,// mapping to 'Device' column in slot excel file
  //beamlinePosition: Number,// Beam line position (dm)
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
    ref: Group.modelName,
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
  // elementName: String,
  // InnerDiameter: String,// Minimum Beam Pipe Inner Diameter (mm)
  // flangeLength: Number,// Element Flange to Flange Length (m)
  // placeHolder: Number,
  // effectiveLength: Number,// Element Effective Length (m)
  // coordinateX: Number,// Global Coordinate X (m)
  // coordinateY: Number,
  // coordinateZ: Number,
  // center2centerLength: Number,// Accumulated center-to-center Length (m)
  // end2endLength: Number,// Accumulated end-to-end Length (m)
  // comment: String,
  // artemisDistance: Number,// Distance from Artemis source (m) ???
  // the following attributes not in slot excel file
  // owner: String,
  // area: String,
  // /**
  //  * 0: device not installed
  //  * 1: device installed
  //  * 2: DO OK
  //  * 2.5: slot DRR checklist
  //  * 3: AM approved
  //  * 4: DRR approved
  //  */
  // status: {
  //   type: Number,
  //   default: 0,
  //   enum: [0, 1, 2, 2.5, 3, 4]
  // },
  // approvalStatus: {
  //   type: Boolean,
  //   default: false
  // },
  // machineMode: String,
  // inGroup: {
  //   type: ObjectId,
  //   ref: 'SlotGroup'
  // }
});

history.addHistory(slotSchema, {
  watchAll: true,
});

export const Slot = history.model<Slot>(MODEL_NAME, slotSchema);

/**
 * Model to represent a physical entity.
 */
import * as mongoose from 'mongoose';

import * as history from  '../shared/history';

type ObjectId = mongoose.Types.ObjectId;

export interface IDevice {
  name: string;
  desc: string;
  dept: string;
  deviceType: string;
  checklistId?: ObjectId;
};

export interface Device extends IDevice, history.Document<Device> {
  // no additional methods
};

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

// Device represents a physical entity
//   name: unique machine readable name
//   desc: descriptive human readable name
//   dept: assocaiate department
//   deviceType: standard type identifier
//   checklistId: associated checklist (optional)
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
    // TODO: Make this dynamic
    ref: 'Checklist',
  },
  // owner: {
  //   type: String,
  //   required: true,
  // },
  // managed: {
  //   type: Boolean,
  //   default: true,
  // },
  // area: {
  //   type: String,
  //   required: true
  // },
  // irrApproval: {
  //   status: {
  //     type: String,
  //     default: '',
  //   },
  //   comment: {
  //     type: String,
  //     default: '',
  //   },
  // },
  // checkedValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0,
  // },
  // totalValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0,
  // },
  // installToDevice: {
  //   serialNo: {
  //     type: String,
  //     default: null,
  //   },
  //   id: {
  //     type: String,
  //     default: null,
  //   },
  // },
  // installToSlot: {
  //   name: {
  //     type: String,
  //     default: null,
  //   },
  //   id: {
  //     type: String,
  //     default: null,
  //   },
  // },
  // /**
  //  * 0: not installed
  //  * 1: prepare to install
  //  * 1.5: prepare installation checklist
  //  * 2: approved to install
  //  * 3: installed
  //  */
  // status: {
  //   type: Number,
  //   default: 0,
  //   enum: [0, 1, 1.5, 2, 3],
  // },
});

deviceSchema.plugin(history.addHistory, {
  pathsToWatch: [
    'name',
    'desc',
    'dept',
    'deviceType',
    'checklistId',
  ],
});

export const Device = mongoose.model<Device>('Device', deviceSchema);

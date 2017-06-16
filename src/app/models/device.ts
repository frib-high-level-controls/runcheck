/**
 * Model to represent a physical device.
 */
import mongoose = require('mongoose');

import history = require('./history');

type ObjectId = mongoose.Types.ObjectId;

export interface Device extends history.DocumentWithHistory<Device> {
  serialNo: string;
  name: string;
  type: string;
  dept: string;
  owner: string;
  checklist?: ObjectId;
};

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const deviceSchema = new Schema({
  serialNo: {
    type: String,
    index: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  owner: {
    type: String,
    required: true,
  },
  managed: {
    type: Boolean,
    default: true,
  },
  // area: {
  //   type: String,
  //   required: true
  // },
  department: {
    type: String,
    required: true,
  },
  checklist: {
    type: ObjectId,
    default: null,
  },
  irrApproval: {
    status: {
      type: String,
      default: '',
    },
    comment: {
      type: String,
      default: '',
    },
  },
  checkedValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  installToDevice: {
    serialNo: {
      type: String,
      default: null,
    },
    id: {
      type: String,
      default: null,
    },
  },
  installToSlot: {
    name: {
      type: String,
      default: null,
    },
    id: {
      type: String,
      default: null,
    },
  },
  /**
   * 0: not installed
   * 1: prepare to install
   * 1.5: prepare installation checklist
   * 2: approved to install
   * 3: installed
   */
  status: {
    type: Number,
    default: 0,
    enum: [0, 1, 1.5, 2, 3],
  },
});

deviceSchema.plugin(history.addHistory, {
  watchAll: true,
});

export const Device = mongoose.model<Device>('Device', deviceSchema);

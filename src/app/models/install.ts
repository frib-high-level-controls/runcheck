/*
 * Model representing the installation of device into slot.
 */
import * as mongoose from 'mongoose';

import { Device } from './device';
import { Slot } from './slot';


type ObjectId = mongoose.Types.ObjectId;

export interface IInstall {
  slotId: ObjectId;
  deviceId: ObjectId;
  installBy: string;
  installOn: Date;
  state: 'INSTALLING' | 'INSTALLED' | 'UNINSTALLING';
};

export interface Install extends IInstall, mongoose.Document {
  // no additional methods
};

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

/**
 * deviceSlot is used to commit transaction for device install to slot
 */
const installSchema = new Schema({
  slotId: {
    type: ObjectId,
    index: true,
    unique: true,
    ref: Slot.modelName,
  },
  deviceId: {
    type: ObjectId,
    index: true,
    unique: true,
    ref: Device.modelName,
  },
  installBy: {
    type: String,
    required: true,
  },
  installOn: {
    type: Date,
    required: true,
  },
  state: {
    type: String,
    required: true,
    enum: [ 'INSTALLING', 'INSTALLED', 'UNINSTALLING' ],
  },
});

export const Install = mongoose.model<Install>('Install', installSchema);

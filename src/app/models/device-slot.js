var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

/**
 * deviceSlot is used to commit transaction for device install to slot
 */
var deviceSlot = new Schema({
  deviceId: {
    type: ObjectId,
    index: true,
    unique: true
  },
  slotId: {
    type: ObjectId,
    index: true,
    unique: true
  }
});

var DeviceSlot= mongoose.model('DeviceSlot', deviceSlot);

module.exports = {
  DeviceSlot: DeviceSlot
};
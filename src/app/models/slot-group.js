var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
var Mixed = Schema.Types.Mixed;

var slotGroup = new Schema({
  name: {
    type: String,
    index: true,
    unique: true
  },
  area: String,
  description: String,
  slots: [ObjectId],
  ARRChecklist: Mixed,
  DRRChecklist: Mixed,
  createdBy: String,
  createdOn: {
    type: Date,
    default: Date.now }
});

var SlotGroup = mongoose.model('SlotGroup', slotGroup);

module.exports = {
  SlotGroup: SlotGroup
};
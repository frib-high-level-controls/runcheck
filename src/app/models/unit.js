var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

/*******
 * A unit is a real org unit or a virtual unit, and the leader has its
 * authorization. The admin maintains it for the authorization control.
 * name: the short name
 * fullName: the long name
 * leader: the leader's AD id
 * devices: owned devices
 * slots: owned slots
 * slotGroups: owned slot groups
 *******/
var unit = new Schema({
  name: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  fullName: {
    type: String,
    trim: true
  },
  leader: {
    type: String,
    lowercase: true,
    trim: true
  },
  devices: [ObjectId],
  slots: [ObjectId],
  slotGroups: [ObjectId]
});

var Unit = mongoose.model('Unit', unit);
module.exports = {
  Unit: Unit
};

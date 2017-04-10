var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var addHistory = require('./history').addHistory;

var subjects = require('./device').subjects;


/*******
 * adid: use id from AD converted to lower case
 * name: full name
 * lastLoginOn: latest login time
 * roles: leader: the leader of a group or a subject; admin: the admin of the
 * application
 * expert: the subject matter. Set to null to remove.
 *******/
var user = new Schema({
  adid: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: String,
  email: String,
  office: String,
  phone: String,
  mobile: String,
  roles: {
    type: Mixed,
    default: {}
  },
  expert: {
    type: String,
    enum: subjects
  },
  lastLoginOn: Date
});

user.plugin(addHistory, {
  fieldsToWatch: ['roles.admin', 'roles.leader', 'expert']
});

var User = mongoose.model('User', user);
module.exports = {
  User: User,
  userSchema: user
};

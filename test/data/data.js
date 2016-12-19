var mongoose = require('mongoose');

var log = require('../../lib/log');

var User = require('../../models/user').User;
var Device = require('../../models/device').Device;

var ChecklistItem = require('../../models/checklist').ChecklistItem;

var data = {
  users: require('./users'),
  devices: require('./devices'),
  checklistItems: require('./checklistitems')
};

var prm;


function create(cb) {
  if (prm) {
    return prm;
  }
  var users = User.create(data.users).catch(function (err) {
    log.error('Creating users failed: %s', err);
    return Promise.reject(err);
  });
  var devices = Device.create(data.devices).catch(function (err) {
    log.error('Creating devices failed: %s', err);
    return Promise.reject(err);
  })
  var checklistItems = ChecklistItem.create(data.checklistItems).catch(function (err) {
    log.error("Creating checklistItems failed: %s", err);
    return Promise.reject(err);
  });
  
  return prm = Promise.all([users, devices, checklistItems]);
}

data.create = create;


function drop() {
  mongoose.connection.db.dropDatabase();
}

data.drop = drop;


module.exports = data;

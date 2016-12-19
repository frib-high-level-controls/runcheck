var request = require('supertest');

var Device = require('../models/device').Device;

var app = require('./app');
var data = require('./data/data');

before(function () {
  return data.create();
});

after(function () {
  data.drop();
});


describe('Device T99999-TEST-0009-0099-S00002', function () {

  var device;

  before(function () {
    return Device.findOne({
      serialNo:"T99999-TEST-0009-0099-S00002"
    })
    .then(function (d) {
      device = d;
    })
  });

  it('User "feam" assign checklist', function (done) {
    request(app)
      .put('/devices/' + device._id + '/checklist/json')
      .auth('feam')
      .expect(403, done);
  });
  
  it('User "fedm" assign checklist', function (done) {
    request(app)
      .put('/devices/' + device._id + '/checklist/json')
      .auth('fedm')
      .expect(200, done);
  });
});

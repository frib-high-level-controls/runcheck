/* tslint:disable:line
/*
 * Utility for loading test data.
 */
import mongoose = require('mongoose');

import * as auth from '../app/shared/auth';

import {
  Device,
  IDevice,
} from '../app/models/device';

import {
  ChecklistSubject,
  IChecklistSubject,
} from '../app/models/checklist';

import * as forgapi from './shared/mock-forgapi';

mongoose.Promise = global.Promise;

const MONGO_URL = 'mongodb://localhost:27017/runcheck-test';
// To populate the DB for development, use this URL:
// const MONGO_URL = 'mongodb://localhost:27017/forg-dev';

const MONGO_OPTS = {
  useMongoClient: true,
};


const USERS: forgapi.User[] = [
  { uid: 'FEAM',
    lastname: '',
    firstname: '',
    fullname: 'FE Area Manager',
    roles: [ 'USR:FEAM', 'GRP:ADB:FRONT_END', 'GRP:ADB:FRONT_END#LEADER' ],
  }, {
    uid: 'FEDM',
    lastname: '',
    firstname: '',
    fullname: 'FE Dept Manager',
    roles: [ 'USR:FEDM', 'GRP:ISF:LAB.DIV.FE', 'GRP:ISF:LAB.DIV.FE#LEADER' ],
  },
];

const DEVICES: IDevice[] = [
  {
    name: 'T99999-TEST-0009-0099-S00001',
    desc: 'Test Device #1',
    deviceType: 'DEV',
    dept: 'ISF:LAB.DIV.FE',
    checklistId: null,
  }, {
    name: 'T99999-TEST-0009-0099-S00002',
    desc: 'Test Device #2',
    deviceType: 'DEV',
    dept: 'ISF:LAB.DIV.FE',
    checklistId: null,
  },
];

const CL_SUBJECTS: IChecklistSubject[] = [
  { name: 'EE',    desc: 'EE',    checklistId: null, checklistType: 'device-default', order:0, assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ],       'mandatory': false, 'required': true, 'final': false },
  { name: 'ME',    desc: 'ME',    checklistId: null, checklistType: 'device-default', order:1, assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ],     'mandatory': false, 'required': true, 'final': false },
  { name: 'CRYO',  desc: 'CRYO',  checklistId: null, checklistType: 'device-default', order:2, assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ], 'mandatory': false, 'required': true, 'final': false },
  { name: 'PHYS',  desc: 'PHYS',  checklistId: null, checklistType: 'device-default', order:3, assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ],            'mandatory': false, 'required': true, 'final': false },
  { name: 'CTRLS', desc: 'CTRLS', checklistId: null, checklistType: 'device-default', order:4, assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ],   'mandatory': false, 'required': true, 'final': false },
  { name: 'ESHQ',  desc: 'ESHQ',  checklistId: null, checklistType: 'device-default', order:5, assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ],               'mandatory': false, 'required': true, 'final': false },
  { name: 'DO',    desc: 'DO',    checklistId: null, checklistType: 'device-default', order:6, assignees: [ 'VAR:DEPT_LEADER' ],                          'mandatory': true,  'required': true, 'final': true  },

  { name: 'DO',    desc: 'DO',    checklistId: null, checklistType: 'slot-default', order:0, assignees: [ 'VAR:DEPT_LEADER' ],                          'mandatory': false, 'required': true, 'final': false },
  { name: 'EE',    desc: 'EE',    checklistId: null, checklistType: 'slot-default', order:1, assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ],       'mandatory': false, 'required': true, 'final': false },
  { name: 'ME',    desc: 'ME',    checklistId: null, checklistType: 'slot-default', order:2, assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ],     'mandatory': false, 'required': true, 'final': false },
  { name: 'CRYO',  desc: 'CRYO',  checklistId: null, checklistType: 'slot-default', order:3, assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ], 'mandatory': false, 'required': true, 'final': false },
  { name: 'PHYS',  desc: 'PHYS',  checklistId: null, checklistType: 'slot-default', order:4, assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ],            'mandatory': false, 'required': true, 'final': false },
  { name: 'CTRLS', desc: 'CTRLS', checklistId: null, checklistType: 'slot-default', order:5, assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ],   'mandatory': false, 'required': true, 'final': false },
  { name: 'ESHQ',  desc: 'ESHQ',  checklistId: null, checklistType: 'slot-default', order:6, assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ],               'mandatory': false, 'required': true, 'final': false },
  { name: 'AM',    desc: 'AM',    checklistId: null, checklistType: 'slot-default', order:7, assignees: [ 'VAR:AREA_LEADER' ],                          'mandatory': true,  'required': true, 'final': true  }
];


let initialized: Promise<void> | undefined;

export function initialize(): Promise<void> {
  if (initialized) {
    return initialized;
  }
  initialized = doInititialize();
  return initialized;
};

async function doInititialize(): Promise<void> {
  await mongoose.connect(MONGO_URL, MONGO_OPTS);

  // clear the database
  await mongoose.connection.db.dropDatabase();

  forgapi.MockClient.getInstance().addUser(USERS);

  for (let DEVICE of DEVICES) {
    await new Device(DEVICE).saveWithHistory('SYS:TEST');
  }

  for (let SUBJECT of CL_SUBJECTS) {
    await new ChecklistSubject(SUBJECT).saveWithHistory('SYS:TEST');
  }
};

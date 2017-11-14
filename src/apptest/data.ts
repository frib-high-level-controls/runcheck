/* tslint:disable:line
/*
 * Utility for loading test data.
 */
import * as mongoose from 'mongoose';

import {
  Device,
  IDevice,
} from '../app/models/device';

import {
  ISlot,
  Slot,
} from '../app/models/slot';

import {
  ChecklistSubject,
  IChecklistSubject,
} from '../app/models/checklist';

import * as forgapi from './shared/mock-forgapi';


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
    dept: 'ISF:LAB.DIV.FE',
    deviceType: 'DEV',
  }, {
    name: 'T99999-TEST-0009-0099-S00002',
    desc: 'Test Device #2',
    dept: 'ISF:LAB.DIV.FE',
    deviceType: 'DEV',
  },
];

const SLOTS: ISlot[] = [
  {
    name: 'FE_TEST:DEV_D0001',
    desc: 'Test Slot #1',
    area: 'ADB:FRONT_END',
    deviceType: 'DEV',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'NORMAL',
  },
];

const CL_SUBJECTS: IChecklistSubject[] = [
  { name: 'EE',    desc: 'EE',    checklistId: null, checklistType: 'device-default', order: 0,
    assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ], mandatory: false, required: true, final: false },
  { name: 'ME',    desc: 'ME',    checklistId: null, checklistType: 'device-default', order: 1,
    assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ], mandatory: false, required: true, final: false },
  { name: 'CRYO',  desc: 'CRYO',  checklistId: null, checklistType: 'device-default', order: 2,
    assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ], mandatory: false, required: true, final: false },
  { name: 'PHYS',  desc: 'PHYS',  checklistId: null, checklistType: 'device-default', order: 3,
    assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ], mandatory: false, required: true, final: false },
  { name: 'CTRLS', desc: 'CTRLS', checklistId: null, checklistType: 'device-default', order: 4,
    assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ],   mandatory: false, required: true, final: false },
  { name: 'ESHQ',  desc: 'ESHQ',  checklistId: null, checklistType: 'device-default', order: 5,
    assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ], mandatory: false, required: true, final: false },
  { name: 'DO',    desc: 'DO',    checklistId: null, checklistType: 'device-default', order: 6,
    assignees: [ 'VAR:DEPT_LEADER' ], mandatory: true,  required: true, final: true  },

  { name: 'DO',    desc: 'DO',    checklistId: null, checklistType: 'slot-default', order: 0,
    assignees: [ 'VAR:DEPT_LEADER' ], mandatory: false, required: true, final: false },
  { name: 'EE',    desc: 'EE',    checklistId: null, checklistType: 'slot-default', order: 1,
    assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ], mandatory: false, required: true, final: false },
  { name: 'ME',    desc: 'ME',    checklistId: null, checklistType: 'slot-default', order: 2,
    assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ], mandatory: false, required: true, final: false },
  { name: 'CRYO',  desc: 'CRYO',  checklistId: null, checklistType: 'slot-default', order: 3,
    assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ], mandatory: false, required: true, final: false },
  { name: 'PHYS',  desc: 'PHYS',  checklistId: null, checklistType: 'slot-default', order: 4,
    assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ], mandatory: false, required: true, final: false },
  { name: 'CTRLS', desc: 'CTRLS', checklistId: null, checklistType: 'slot-default', order: 5,
    assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ], mandatory: false, required: true, final: false },
  { name: 'ESHQ',  desc: 'ESHQ',  checklistId: null, checklistType: 'slot-default', order: 6,
    assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ], mandatory: false, required: true, final: false },
  { name: 'AM',    desc: 'AM',    checklistId: null, checklistType: 'slot-default', order: 7,
    assignees: [ 'VAR:AREA_LEADER' ], mandatory: true,  required: true, final: true },
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
  // clear the database
  await mongoose.connection.db.dropDatabase();

  forgapi.MockClient.getInstance().addUser(USERS);

  for (let device of DEVICES) {
    await new Device(device).saveWithHistory('SYS:TEST');
  }

  for (let slot of SLOTS) {
    await new Slot(slot).saveWithHistory('SYS:TEST');
  }

  for (let subject of CL_SUBJECTS) {
    await new ChecklistSubject(subject).saveWithHistory('SYS:TEST');
  }
};

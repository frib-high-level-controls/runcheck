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
  IGroup,
  Group,
} from '../app/models/group';

import {
  ChecklistSubject,
  IChecklistSubject,
} from '../app/models/checklist';

import * as forgapi from './shared/mock-forgapi';


export const USERS: forgapi.User[] = [
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

export const DEVICES: IDevice[] = [
  {
    name: 'T99999-DEVA-0009-0099-S00001',
    desc: 'Test Device #1',
    dept: 'ISF:LAB.DIV.FE',
    deviceType: 'DEVA',
  }, {
    name: 'T99999-DEVB-0009-0099-S00002',
    desc: 'Test Device #2',
    dept: 'ISF:LAB.DIV.FE',
    deviceType: 'DEVB',
  },
];

export const SLOTS: ISlot[] = [
  {
    name: 'FE_TEST:DEVA_D0001',
    desc: 'Test Slot #1',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'NORMAL',
  }, {
    name: 'FE_TEST:DEVB_D0002',
    desc: 'Test Slot #2',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVB',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'CONTROL',
  }, {
    name: 'FE_TEST:DEVA_D0003',
    desc: 'Test Slot #3',
    area: 'ISF:LAB.DIV.FE',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'NORMAL',
  }, {
    name: 'FE_TEST:DEVA_D0004',
    desc: 'Test Slot #4',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'NORMAL',
    groupId: new mongoose.mongo.ObjectId('56cb91bdc3464f14678934ca'),
  }, {
    name: 'FE_TEST:DEVA_D0002',
    desc: 'Test Slot #2',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: 'MEDIUM',
    safetyLevel: 'CONTROL',
  },
];

export const GROUPS: IGroup[] = [
  {
    name: 'FE_TEST:GROUP_1',
    desc: 'Test Group #1',
    owner: 'ADB:FRONT_END',
    memberType: 'Slot',
    safetyLevel: 'NORMAL',
  }, {
    name: 'FE_TEST:GROUP_2',
    desc: 'Test Group #2',
    owner: 'ADB:FRONT_END',
    memberType: 'Slot',
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

  for (let group of GROUPS) {
    await new Group(group).saveWithHistory('SYS:TEST');
  }

  for (let subject of CL_SUBJECTS) {
    await new ChecklistSubject(subject).saveWithHistory('SYS:TEST');
  }
};

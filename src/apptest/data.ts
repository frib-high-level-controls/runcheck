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
  },
];

const CL_SUBJECTS: IChecklistSubject[] = [
  { name: 'EE',    desc: 'EE', checklistType: 'device-default', order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ] },
  { name: 'ME',    desc: 'ME', checklistType: 'device-default', order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ] },
  { name: 'CRYO',  desc: 'CRYO', checklistType: 'device-default', order: 2,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ] },
  { name: 'PHYS',  desc: 'PHYS', checklistType: 'device-default', order: 3,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ] },
  { name: 'CTRLS', desc: 'CTRLS', checklistType: 'device-default', order: 4,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ] },
  { name: 'ESHQ',  desc: 'ESHQ', checklistType: 'device-default', order: 5,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ] },
  { name: 'DO',    desc: 'DO', checklistType: 'device-default', order: 6,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ] },

  { name: 'DO',    desc: 'DO',    checklistType: 'slot-default', order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ] },
  { name: 'EE',    desc: 'EE',    checklistType: 'slot-default', order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:RUSSO#IFS:LAB.FRIB.ASD.ELECENG' ] },
  { name: 'ME',    desc: 'ME',    checklistType: 'slot-default', order: 2,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:BULTMAN#IFS:LAB.FRIB.ASD.MECHENG' ] },
  { name: 'CRYO',  desc: 'CRYO',  checklistType: 'slot-default', order: 3,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:CASAGRAN#IFS:LAB.FRIB.ASD.CRYOGENICS' ] },
  { name: 'PHYS',  desc: 'PHYS',  checklistType: 'slot-default', order: 4,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:OSTROUMO#IFS:LAB.FRIB.ASD' ] },
  { name: 'CTRLS', desc: 'CTRLS', checklistType: 'slot-default', order: 5,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:DAVIDSON#IFS:LAB.FRIB.ASD.CONTROLS' ] },
  { name: 'ESHQ',  desc: 'ESHQ',  checklistType: 'slot-default', order: 6,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:FEYZI#IFS:LAB.FRIB.ASD' ] },
  { name: 'AM',    desc: 'AM',    checklistType: 'slot-default', order: 7,
    primary: true, final: false, mandatory: true, required: true,
    assignees: [ 'VAR:AREA_LEADER' ] },
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

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
  Group,
  IGroup,
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
  }, {
    uid: 'EESME',
    lastname: '',
    firstname: '',
    fullname: 'EE Subject Matter Expert',
    roles: [ 'USR:EESME', 'GRP:ISF:LAB.DIV.EE', 'GRP:ISF:LAB.DIV.EE#LEADER' ],
  }, {
    uid: 'MESME',
    lastname: '',
    firstname: '',
    fullname: 'ME Subject Matter Expert',
    roles: [ 'USR:MESME', 'GRP:ISF:LAB.DIV.ME', 'GRP:ISF:LAB.DIV.ME#LEADER' ],
  }, {
    uid: 'ALTSME',
    lastname: '',
    firstname: '',
    fullname: 'Alternative Subject Matter Expert',
    roles: [ 'USR:ALTSME', 'GRP:ISF:LAB.DIV.GRP' ],
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

export const GROUPS: IGroup[] = [
  {
    name: 'FE_SLOT_GROUP01',
    desc: 'Front End Slot Group #1',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
  }, {
    name: 'FE_SLOT_GROUP02',
    desc: 'Front End Slot Group #2',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
  },
];

const CL_SUBJECTS: IChecklistSubject[] = [
  {
    name: 'EE', desc: 'EE', checklistType: 'DEVICE-DEFAULT', order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:EESME' ],
  }, {
    name: 'ME', desc: 'ME', checklistType: 'DEVICE-DEFAULT', order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:MESME' ],
  }, {
    name: 'DO', desc: 'DO', checklistType: 'DEVICE-DEFAULT', order: 2,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ],
  }, {
    name: 'DO', desc: 'DO', checklistType: 'SLOT-DEFAULT', order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ],
  }, {
    name: 'EE', desc: 'EE', checklistType: 'SLOT-DEFAULT', order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:EESME' ],
  }, {
    name: 'ME', desc: 'ME', checklistType: 'SLOT-DEFAULT', order: 2,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:MESME' ],
  }, {
    name: 'AM', desc: 'AM', checklistType: 'SLOT-DEFAULT', order: 3,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:AREA_LEADER' ],
  },
];


// let initialized: Promise<void> | undefined;

export async function initialize(): Promise<void> {
//   if (initialized) {
//     return initialized;
//   }
//   initialized = doInititialize();
//   return initialized;
// };

// async function doInititialize(): Promise<void> {
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

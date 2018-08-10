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
  CareLevel,
  ISlot,
  SafetyLevel,
  Slot,
} from '../app/models/slot';

import {
  Group,
  IGroup,
} from '../app/models/group';

import {
  ChecklistSubject,
  ChecklistType,
  IChecklistSubject,
} from '../app/models/checklist';

import * as forgapi from './shared/mock-forgapi';

const DEVICE_DEFAULT = ChecklistType.DEVICE_DEFAULT;
const SLOT_DEFAULT = ChecklistType.SLOT_DEFAULT;
const SLOT_SAFETY =  ChecklistType.SLOT_SAFETY;

export const USERS: forgapi.User[] = [
  { uid: 'FEAM',
    fullname: 'FE Area Manager',
    roles: [ 'USR:FEAM', 'GRP:ADB:FRONT_END', 'GRP:ADB:FRONT_END#LEADER' ],
  }, {
    uid: 'FEDM',
    fullname: 'FE Dept Manager',
    roles: [ 'USR:FEDM', 'GRP:ISF:LAB.DIV.FE', 'GRP:ISF:LAB.DIV.FE#LEADER' ],
  }, {
    uid: 'EESME',
    fullname: 'EE Subject Matter Expert',
    roles: [ 'USR:EESME', 'GRP:ISF:LAB.DIV.EE', 'GRP:ISF:LAB.DIV.EE#LEADER' ],
  }, {
    uid: 'MESME',
    fullname: 'ME Subject Matter Expert',
    roles: [ 'USR:MESME', 'GRP:ISF:LAB.DIV.ME', 'GRP:ISF:LAB.DIV.ME#LEADER' ],
  }, {
    uid: 'ALTSME',
    fullname: 'Alternative Subject Matter Expert',
    roles: [ 'USR:ALTSME', 'GRP:ISF:LAB.DIV.GRP' ],
  }, {
    uid: 'LSM',
    fullname: 'Laboratory Safety Manager',
    roles: [ 'USR:LSM' ],
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
    careLevel: CareLevel.MEDIUM,
    safetyLevel: SafetyLevel.NONE,
    machineModes: [ 'M00', 'M01A', 'M01B', 'M02', 'M03' ],
  }, {
    name: 'FE_TEST:DEVB_D0002',
    desc: 'Test Slot #2',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVB',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: CareLevel.MEDIUM,
    safetyLevel: SafetyLevel.CONTROL_ESH,
    machineModes: [ 'M01A', 'M01B', 'M02', 'M03' ],
  }, {
    name: 'FE_TEST:DEVA_D0003',
    desc: 'Test Slot #3',
    area: 'ISF:LAB.DIV.FE',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: CareLevel.MEDIUM,
    safetyLevel: SafetyLevel.NONE,
    machineModes: [ 'M01B', 'M02', 'M03' ],
  }, {
    name: 'FE_TEST:DEVA_D0004',
    desc: 'Test Slot #4',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: CareLevel.MEDIUM,
    safetyLevel: SafetyLevel.NONE,
    machineModes: [ 'M02', 'M03' ],
  }, {
    name: 'FE_TEST:DEVA_D0002',
    desc: 'Test Slot #2',
    area: 'ADB:FRONT_END',
    deviceType: 'DEVA',
    arr: 'ARR0X',
    drr: 'DRR0X-0Y',
    careLevel: CareLevel.HIGH,
    safetyLevel: SafetyLevel.CONTROL_ESH,
    machineModes: [ 'M03' ],
  },
];

export const GROUPS: IGroup[] = [
  {
    name: 'FE_SLOT_GROUP01',
    desc: 'Front End Slot Group #1',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
    safetyLevel: SafetyLevel.NONE,
  }, {
    name: 'FE_SLOT_GROUP02',
    desc: 'Front End Slot Group #2',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
    safetyLevel: SafetyLevel.NONE,
  }, {
    name: 'FE_TEST:GROUP_1',
    desc: 'Test Group #1',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
    safetyLevel: SafetyLevel.NONE,
  }, {
    name: 'FE_TEST:GROUP_2',
    desc: 'Test Group #2',
    owner: 'ADB:FRONT_END',
    memberType: Slot.modelName,
    safetyLevel: SafetyLevel.NONE,
  },
];

const CL_SUBJECTS: IChecklistSubject[] = [
  {
    name: 'EE', desc: 'EE', checklistType: DEVICE_DEFAULT, order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:EESME' ],
  }, {
    name: 'ME', desc: 'ME', checklistType: DEVICE_DEFAULT, order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:MESME' ],
  }, {
    name: 'DO', desc: 'DO', checklistType: DEVICE_DEFAULT, order: 2,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ],
  }, {
    name: 'DO', desc: 'DO', checklistType: SLOT_DEFAULT, order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ],
  }, {
    name: 'EE', desc: 'EE', checklistType: SLOT_DEFAULT, order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:EESME' ],
  }, {
    name: 'ME', desc: 'ME', checklistType: SLOT_DEFAULT, order: 2,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:MESME' ],
  }, {
    name: 'AM', desc: 'AM', checklistType: SLOT_DEFAULT, order: 3,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:AREA_LEADER' ],
  },  {
    name: 'DO', desc: 'DO', checklistType: SLOT_SAFETY, order: 0,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'VAR:DEPT_LEADER' ],
  }, {
    name: 'EE', desc: 'EE', checklistType: SLOT_SAFETY, order: 1,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:EESME' ],
  }, {
    name: 'ME', desc: 'ME', checklistType: SLOT_SAFETY, order: 2,
    primary: false, final: false, mandatory: false, required: true,
    assignees: [ 'USR:MESME' ],
  }, {
    name: 'AM', desc: 'AM', checklistType: SLOT_SAFETY, order: 3,
    primary: true, final: true, mandatory: true, required: true,
    assignees: [ 'VAR:AREA_LEADER' ],
  }, {
    name: 'SM', desc: 'SM', checklistType: SLOT_SAFETY, order: 4,
    primary: false, final: true, mandatory: true, required: true,
    assignees: [ 'USR:LSM' ],
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

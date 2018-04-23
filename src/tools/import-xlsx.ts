import * as fs from 'fs';
import * as util from 'util';

import * as dbg from 'debug';
import mongoose = require('mongoose');
import rc = require('rc');
import * as XLSX from 'xlsx';

import * as auth from '../app/shared/auth';
import * as forgapi from '../app/shared/forgapi';
import * as models from '../app/shared/models';

import * as pnsapi from '../app/lib/pnsapi';

import {
  CARE_LEVELS,
  CareLevel,
  ISlot,
  SAFETY_LEVELS,
  SafetyLevel,
  Slot,
} from '../app/models/slot';

import {
  Device,
  IDevice,
} from '../app/models/device';

import {
  IInstall,
  Install,
} from '../app/models/install';

interface Config {
  configs?: string[];
  h?: {};
  help?: {};
  mongo: {
    user?: {};
    pass?: {};
    port: {};
    addr: {};
    db: {};
    options: {};
  };
  forgapi: {
    url?: {};
    agentOptions?: {};
  };
  pnsapi: {
    url?: {};
    agentOptions?: {};
  };
  dryrun?: {};
  updateBy?: {};
  installBy?: {};
  _?: Array<{}>;
};

enum WorksheetName {
  SLOTS = 'SLOTS',
  DEVICES = 'DEVICES',
  INSTALL = 'INSTALLATIONS',
};

enum SlotColumn {
  NAME = 'FRIB SLOT NAME',
  DESC = 'DESCRIPTION',
  AREA = 'ASSOCIATED AREA',
  DRR = 'ASSOCIATED DRR',
  ARR = 'ASSOCIATED ARR',
  DEVICE_TYPE = 'DEVICE TYPE',
  CARE_LEVEL = 'LEVEL OF CARE',
  SAFETY_LEVEL = 'SAFETY DESIGNATION',
};

enum DeviceColumn {
  NAME = 'FRIB PART NUMBER',
  DESC = 'DESCRIPTION',
  DEPT = 'ASSOCIATED DEPARTMENT',
  DEVICE_TYPE = 'DEVICE TYPE',
};

enum InstallColumn {
  SLOT = 'SLOT',
  DEVICE = 'DEVICE',
  DATE = 'DATE',
};

const debug = dbg('import-xlsx');

const readFile = util.promisify(fs.readFile);

const info = console.info;
const warn = console.warn;
const error = console.error;

const approvedAreas = new Array<string>();
const approvedDepts = new Array<string>();
const approvedNames = new Array<RegExp>();

const SLOT_NAME_REGEX = /^[^\W_]+_[^\W_]+(:[^\W_]+_[^\W_]+)?$/;
const DRR_REGEX = /^DRR[\d?]?[\d?]?(-[\w?]+)?$/;
const ARR_REGEX = /^ARR[\d?]?[\d?]?(-[\w?]+)?$/;
const DEVICE_TYPE_REGEX = /^\S+$/;
const DEVICE_NAME_REGEX = /^\w{6}-\w{3}-\w{4}-\w{4}-\w{6}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

let forgClient: forgapi.IClient;

mongoose.Promise = global.Promise;

async function main() {

  let cfg: Config = {
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'runcheck-dev',
      options: {
        // see http://mongoosejs.com/docs/connections.html
        useMongoClient: true,
      },
    },
    forgapi: {
      // no defaults
    },
    pnsapi: {
      // no defaults
    },
  };

  rc('import-xlsx', cfg);
  if (cfg.configs) {
    for (let file of cfg.configs) {
      info('Load configuration: %s', file);
    }
  }

  if (debug.enabled) {
    debug(JSON.stringify(cfg, null, 4));
  }

  if (cfg.h || cfg.help) {
    info(`Usage: import-xlsx [ options ] data.xlsx

    Options
      -h, --help             display help information
      --config [rcfile]      load configuration from rcfile
      --dryrun [dryrun]      validate CCDB data (default: true)
      --updateBy [username]  username to use for saving history
      --installBy [username] username to use for installations
    `);
    return;
  }

  if (!Array.isArray(cfg._) || (cfg._.length === 0)) {
    error('Error: no data file specified');
    process.exitCode = 1;
    return;
  }

  if (cfg._.length > 1) {
    error('Error: Only one data file can be specified');
    process.exitCode = 1;
    return;
  }

  let updateBy = cfg.updateBy ? String(cfg.updateBy).trim().toUpperCase() : '';
  if (!updateBy) {
    error(`Error: Parameter 'updateBy' is required`);
    process.exitCode = 1;
    return;
  }

  let installBy = cfg.updateBy ? String(cfg.updateBy).trim().toUpperCase() : '';
  if (!installBy) {
    installBy = updateBy; // default to value of updateBy
  }

  const data = await readFile(String(cfg._[0]));
  const workbook = XLSX.read(data, {type: 'buffer', dateNF: 'yyyy-mm-dd'});

  // FORG API configuration
  if (!cfg.forgapi.url) {
    error(`Error: FORG base URL not configured`);
    process.exitCode = 1;
    return;
  }
  info('FORG API base URL: %s', cfg.forgapi.url);

  forgClient = new forgapi.Client({
    url: String(cfg.forgapi.url),
    agentOptions: cfg.forgapi.agentOptions || {},
  });

  const loadGroups = forgClient.findGroups().then((forgGroups) => {
    for (let group of forgGroups) {
      if (group.type === 'DEPT') {
        approvedDepts.push(group.uid);
      }
      if (group.type === 'AREA') {
        approvedAreas.push(group.uid);
      }
    }
  });

  // PNS API configuration
  if (!cfg.pnsapi.url) {
    error(`Error: PNS base URL not configured`);
    process.exitCode = 1;
    return;
  }
  info('PNS API base URL: %s', cfg.pnsapi.url);

  const pnsClient = new pnsapi.Client({
    url: String(cfg.pnsapi.url),
    agentOptions: cfg.pnsapi.agentOptions || {},
  });

  const loadNames = pnsClient.findNames().then((pnsNames) => {
    for (let name of pnsNames) {
      if (name.code) {
        let code = name.code.replace('n', '\\d?');
        approvedNames.push(new RegExp(`^${code}$`));
      }
    }
  });

  await Promise.all([loadGroups, loadNames]);

  let slotSheetName: string | undefined;
  let deviceSheetName: string | undefined;
  let installSheetName: string | undefined;

  for (let sheetName of workbook.SheetNames) {
    switch (sheetName.toUpperCase()) {
    case WorksheetName.SLOTS:
      slotSheetName = sheetName;
      break;
    case WorksheetName.DEVICES:
      deviceSheetName = sheetName;
      break;
    case WorksheetName.INSTALL:
      installSheetName = sheetName;
      break;
    default:
      warn(`Sheet '${sheetName}' is unexpected, ignoring`);
      break;
    }
  }

  let slotResults: SlotImportResult[] = [];
  if (slotSheetName) {
    slotResults = await readSlots(workbook.Sheets[slotSheetName]);
  } else {
    info(`Workbook does not have slots sheet`);
  }

  if (slotResults.length === 0) {
    info('Workbook does not have any slot definitions');
  }

  let deviceResults: DeviceImportResult[] = [];
  if (deviceSheetName) {
    deviceResults = await readDevices(workbook.Sheets[deviceSheetName]);
  } else {
    info(`Workbook does not have devices sheet`);
  }

  if (deviceResults.length === 0) {
    info('Workbook does not have any device definitions');
  }

  let installResults: InstallImportResult[] = [];
  if (installSheetName) {
    installResults = await readInstalls(workbook.Sheets[installSheetName]);
  } else {
    info(`Workbook does not have installation sheet`);
  }

  if (installResults.length === 0) {
    info('Workbook does not have any installation definitions');
  }

  if (hasResultError(slotResults, deviceResults, installResults)) {
    printResults(slotResults, deviceResults, installResults);
    process.exitCode = 1;
    return;
  }

  // Configure Mongoose (MongoDB)
  let mongoUrl = 'mongodb://';
  if (cfg.mongo.user) {
    mongoUrl += encodeURIComponent(String(cfg.mongo.user));
    if (cfg.mongo.pass) {
      mongoUrl += ':' + encodeURIComponent(String(cfg.mongo.pass));
    }
    mongoUrl += '@';
  }
  mongoUrl += cfg.mongo.addr + ':' + cfg.mongo.port + '/' + cfg.mongo.db;

  await mongoose.connect(mongoUrl, cfg.mongo.options);

  try {
    let slots = await models.mapByPath('name', Slot.find().exec());

    let modifiedSlots = new Map<string, Slot>();
    for (let result of slotResults) {
      let slot = slots.get(result.slot.name);
      if (slot) {
        result.errors.push(`Slot with name, '${result.slot.name}', already exisits`);
        continue;
      }
      slot = new Slot(result.slot);
      try {
        await slot.validate();
      } catch (err) {
        result.errors.push(String(err));
        continue;
      }
      slots.set(slot.name, slot);
      modifiedSlots.set(slot.id, slot);
    }

    let devices = await models.mapByPath('name', Device.find().exec());

    let modifiedDevices = new Map<string, Device>();
    for (let result of deviceResults) {
      let device = devices.get(result.device.name);
      if (device) {
        result.errors.push(`Device with name, '${result.device.name}', already exisits`);
        continue;
      }
      device = new Device(result.device);
      try {
        await device.validate();
      } catch (err) {
        result.errors.push(String(err));
        continue;
      }
      devices.set(device.name, device);
      modifiedDevices.set(device.id, device);
    }

    let modifiedInstalls: Install[] = [];
    for (let result of installResults) {
      let slot = slots.get(result.install.slotName);
      if (!slot) {
        result.errors.push(`Slot for install, '${result.install.slotName}', not found`);
        continue;
      }
      if (slot.installDeviceId) {
        result.errors.push(`Slot '${result.install.slotName}' is already installed`);
        continue;
      }
      let device = devices.get(result.install.deviceName);
      if (!device) {
        result.errors.push(`Device for install, '${result.install.deviceName}', not found`);
        continue;
      }
      if (device.installSlotId) {
        result.errors.push(`Device '${result.install.deviceName}' is already installed`);
        continue;
      }
      let doc: IInstall = {
        slotId: slot._id,
        deviceId: device._id,
        installOn: result.install.installOn,
        installBy: installBy,
        state: 'INSTALLING',
      };
      let install = new Install(doc);
      try {
        await install.validate();
      } catch (err) {
        result.errors.push(String(err));
        continue;
      }
      // update the slot and device for the installation
      slot.installDeviceId = install.deviceId;
      slot.installDeviceOn = install.installOn;
      slot.installDeviceBy = install.installBy;
      if (!modifiedSlots.has(slot.id)) {
        modifiedSlots.set(slot.id, slot);
      }
      device.installSlotId = install.slotId;
      device.installSlotOn = install.installOn;
      device.installSlotBy = install.installBy;
      if (!modifiedDevices.has(device.id)) {
        modifiedDevices.set(device.id, device);
      }
      modifiedInstalls.push(install);
    }

    if (hasResultError(slotResults, deviceResults, installResults)) {
      printResults(slotResults, deviceResults, installResults);
      process.exitCode = 1;
      return;
    }

    if (cfg.dryrun !== false && cfg.dryrun !== 'false') {
      printResults(slotResults, deviceResults, installResults);
      info('DRYRUN DONE');
      process.exitCode = 1;
      return;
    }

    { // start installations
      let prms: Array<Promise<Install>> = [];
      for (let install of modifiedInstalls) {
        info(`Start installation: ${JSON.stringify(install, null, 4)}`);
        prms.push(install.save());
      }
      await Promise.all(prms);
    }

    {
      let prms: Array<Promise<Slot | Device>> = [];
      for (let slot of modifiedSlots.values()) {
        info(`Save slot: ${JSON.stringify(slot, null, 4)}`);
        prms.push(slot.saveWithHistory(auth.formatRole('USR', installBy)));
      }
      for (let device of modifiedDevices.values()) {
        info(`Save device: ${JSON.stringify(device, null, 4)}`);
        prms.push(device.saveWithHistory(auth.formatRole('USR', installBy)));
      }
      await Promise.all(prms);
    }

    { // finish installations
      let prms: Array<Promise<Install>> = [];
      for (let install of modifiedInstalls) {
        install.state = 'INSTALLED';
        info(`Finish installation: ${install.id}`);
        prms.push(install.save());
      }
      await Promise.all(prms);
    }
  } finally {
    await mongoose.disconnect();
  }
};

interface ImportResult {
  errors: string[];
}

interface SlotImportResult extends ImportResult {
  slot: ISlot;
};

async function readSlots(worksheet: XLSX.WorkSheet): Promise<SlotImportResult[]> {

  let results: SlotImportResult[] = [];

  let data = XLSX.utils.sheet_to_json(worksheet);

  for (let irow of data) {
    // cast to interface with index signature
    let row = <{ [k: string]: {} | undefined}> irow;

    let name: string | undefined;
    let desc: string | undefined;
    let area: string | undefined;
    let deviceType: string | undefined;
    let careLevel: string | undefined;
    let safetyLevel: string | undefined;
    let drr: string | undefined;
    let arr: string | undefined;

    for (let prop in row) {
      if (row.hasOwnProperty(prop)) {
        switch (prop.trim().toUpperCase()) {
        case SlotColumn.NAME:
          name = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.DESC:
          desc = String(row[prop]).trim();
          break;
        case SlotColumn.AREA:
          area = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.DEVICE_TYPE:
          deviceType = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.CARE_LEVEL:
          careLevel = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.SAFETY_LEVEL:
          safetyLevel = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.DRR:
          drr = String(row[prop]).trim().toUpperCase();
          break;
        case SlotColumn.ARR:
          arr = String(row[prop]).trim().toUpperCase();
          break;
        default:
          warn(`Slot property, '${prop}', is unexpected, ignoring!`);
          break;
        }
      }
    }

    let result: SlotImportResult = {
      slot: {
        name: '',
        desc: '',
        area: '',
        deviceType: '',
        careLevel: CareLevel.LOW,
        safetyLevel: SafetyLevel.NONE,
        arr: '',
        drr: '',
      },
      errors: [],
    };

    if (!name) {
      result.errors.push('Slot name is not specified');
    } else if (!name.match(SLOT_NAME_REGEX)) {
      result.errors.push(`Slot name, '${name}', is not valid`);
    } else {
      result.slot.name = name;
    }

    if (!desc) {
      result.errors.push('Slot description is not specified');
    } else {
      // assume data is safe (sanitized)
      result.slot.desc = desc;
    }

    if (!area) {
      result.errors.push('Slot area is not specified');
    } else if (!approvedAreas.includes(area)) {
      result.errors.push(`Slot area, '${area}', is not found`);
    } else {
      result.slot.area = area;
    }

    if (!deviceType) {
      result.errors.push('Slot device type is not specified');
    } else {
      let found = false;
      for (let approvedName of approvedNames) {
        if (approvedName.test(deviceType)) {
          found = true;
        }
      }
      if (!found) {
        result.errors.push(`Slot device type, '${deviceType}', is not approved`);
      } else {
        result.slot.deviceType = deviceType;
      }
    }

    if (!careLevel) {
      result.errors.push('Slot care level is not specified');
    } else {
      // find the index of the specified care level
      let idx = CARE_LEVELS.reduce((p, v, i) => (p !== -1 || v !== careLevel ? p : i), -1);
      if (idx === -1) {
        result.errors.push(`Slot care level, '${careLevel}', is not valid`);
      } else {
        result.slot.careLevel = CARE_LEVELS[idx];
      }
    }

    if (!safetyLevel) {
      result.errors.push('Slot safety level is not specified');
    } else {
      // find the index of the specified care level
      let idx = SAFETY_LEVELS.reduce((p, v, i) => (p !== -1 || v !== safetyLevel ? p : i), -1);
      if (idx === -1) {
        result.errors.push(`Slot safety level, '${safetyLevel}', is not valid`);
      } else {
        result.slot.safetyLevel = SAFETY_LEVELS[idx];
      }
    }

    if (!drr) {
      result.errors.push('Slot DRR is not specified');
    } else if (!drr.match(DRR_REGEX)) {
      result.errors.push(`Slot DRR, '${drr}', is not valid`);
    } else {
      result.slot.drr = drr;
    }

    if (!arr) {
      result.errors.push('Slot ARR is not specified');
    } else if (!arr.match(ARR_REGEX)) {
      result.errors.push(`Slot ARR, '${drr}', is not valid`);
    } else {
      result.slot.arr = arr;
    }

    results.push(result);
  }

  return results;
};

interface DeviceImportResult extends ImportResult {
  device: IDevice;
};

async function readDevices(worksheet: XLSX.WorkSheet): Promise<DeviceImportResult[]> {
  let results: DeviceImportResult[] = [];

  let data = XLSX.utils.sheet_to_json(worksheet);

  for (let irow of data) {
    // cast to interface with index signature
    let row = <{ [k: string]: {} | undefined}> irow;

    let name: string | undefined;
    let desc: string | undefined;
    let dept: string | undefined;
    let deviceType: string | undefined;

    for (let prop in row) {
      if (row.hasOwnProperty(prop)) {
        switch (prop.toUpperCase()) {
        case DeviceColumn.NAME:
          name = String(row[prop]).trim().toUpperCase();
          break;
        case DeviceColumn.DESC:
          desc = String(row[prop]).trim();
          break;
        case DeviceColumn.DEPT:
          dept = String(row[prop]).trim().toUpperCase();
          break;
        case DeviceColumn.DEVICE_TYPE:
          deviceType = String(row[prop]).trim().toUpperCase();
          break;
        default:
          warn(`Device property, '${prop}', is unexpected, ignoring!`);
          break;
        }
      }
    }

    let result: DeviceImportResult = {
      device: {
        name: '',
        desc: '',
        dept: '',
        deviceType: '',
      },
      errors: [],
    };

    if (!name) {
      result.errors.push('Device name is not specified');
    } else if (!name.match(DEVICE_NAME_REGEX)) {
      result.errors.push(`Device name, '${name}', is not valid`);
    } else {
      result.device.name = name;
    }

    if (!desc) {
      result.errors.push('Device description is not specified');
    } else {
      // assume data is safe (sanitized)
      result.device.desc = desc;
    }

    if (!dept) {
      result.errors.push('Device department is not specified');
    } else if (!approvedDepts.includes(dept)) {
      result.errors.push(`Device department, '${dept}', is not found`);
    } else {
      result.device.dept = dept;
    }

    if (!deviceType) {
      result.errors.push('Device type is not specified');
    } else if (!deviceType.match(DEVICE_TYPE_REGEX)) {
      result.errors.push(`Device type, '${deviceType}', is not valid`);
    } else {
      result.device.deviceType = deviceType;
    }

    results.push(result);
  }

  return results;
};

interface InstallImportResult extends ImportResult {
  install: {
    slotName: string;
    deviceName: string;
    installOn: Date;
  };
};

async function readInstalls(worksheet: XLSX.WorkSheet): Promise<InstallImportResult[]> {
  let results: InstallImportResult[] = [];

  let data = XLSX.utils.sheet_to_json(worksheet);

  for (let irow of data) {
    // cast to interface with index signature
    let row = <{ [k: string]: {} | undefined}> irow;

    let slotName: string | undefined;
    let deviceName: string | undefined;
    let date: string | undefined;

    for (let prop in row) {
      if (row.hasOwnProperty(prop)) {
        switch (prop.toUpperCase()) {
        case InstallColumn.SLOT:
          slotName = String(row[prop]).trim().toUpperCase();
          break;
        case InstallColumn.DEVICE:
          deviceName = String(row[prop]).trim().toUpperCase();
          break;
        case InstallColumn.DATE:
          date = String(row[prop]).trim().toUpperCase();
          break;
        default:
          warn(`Install property, '${prop}', is unexpected, ignoring!`);
          break;
        }
      }
    }

    let result: InstallImportResult = {
      install: {
        slotName: '',
        deviceName: '',
        installOn: new Date(0),
      },
      errors: [],
    };

    if (!slotName) {
      result.errors.push('Install slot name is not specified');
    } else {
      result.install.slotName = slotName;
    }

    if (!deviceName) {
      result.errors.push('Install device name is not specified');
    } else {
      result.install.deviceName = deviceName;
    }

    // Date parsing adapted from similar in routes/slots.ts
    if (!date) {
      result.errors.push('Install date is not specified');
    } else if (!date.match(DATE_REGEX)) {
      result.errors.push(`Install date, '${date}', is invalid (1)`);
    } else {
      let installOn = new Date(date);
      if (!Number.isFinite(installOn.getTime())) {
        result.errors.push(`Install date, '${date}', is invalid (2)`);
      } else {
        result.install.installOn = installOn;
      }
    }

    results.push(result);
  }

  return results;
};

function hasResultError(...importResults: ImportResult[][]): boolean {
  for (let results of importResults) {
    for (let result of results) {
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        return true;
      }
    }
  }
  return false;
};

// tslint:disable:max-line-length
function printResults(slotResults: SlotImportResult[], deviceResults: DeviceImportResult[], installResults: InstallImportResult[]) {

  for (let result of slotResults) {
    info(`Import slot: ${JSON.stringify(result.slot)}`);
    for (let msg of result.errors) {
      error(`Error: ${msg}`);
    }
  }

  for (let result of deviceResults) {
    info(`Import device: ${JSON.stringify(result.device)}`);
    for (let msg of result.errors) {
      error(`Error: ${msg}`);
    }
  }

  for (let result of installResults) {
    info(`Import install: ${JSON.stringify(result.install)}`);
    for (let msg of result.errors) {
      error(`Error: ${msg}`);
    }
  }
};



main().catch((err) =>  {
  // ensure non-zero exit code
  if (process.exitCode === 0) {
    process.exitCode = 1;
  }
  error(`Error: ${err}`);
});
import * as fs from 'fs';
import * as util from 'util';

import * as dbg from 'debug';
import * as mongoose from 'mongoose';
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
    host?: {};
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
    categories?: {};
  };
  dryrun?: {};
  updateBy?: {};
  installBy?: {};
  _?: Array<{}>;
}

enum WorksheetName {
  SLOTS = 'SLOTS',
  DEVICES = 'DEVICES',
  INSTALL = 'INSTALLATIONS',
  UNINSTALL = 'UNINSTALLATIONS',
}

enum SlotColumn {
  NAME = 'FRIB SLOT NAME',
  DESC = 'DESCRIPTION',
  AREA = 'ASSOCIATED AREA',
  DRR = 'ASSOCIATED DRR',
  ARR = 'ASSOCIATED ARR',
  DEVICE_TYPE = 'DEVICE TYPE',
  CARE_LEVEL = 'LEVEL OF CARE',
  SAFETY_LEVEL = 'SAFETY DESIGNATION',
  MACHINE_MODES = 'ASSOCIATED MACHINE MODES',
}

enum DeviceColumn {
  NAME = 'FRIB PART NUMBER',
  DESC = 'DESCRIPTION',
  DEPT = 'ASSOCIATED DEPARTMENT',
  DEVICE_TYPE = 'DEVICE TYPE',
}

enum InstallColumn {
  SLOT = 'SLOT',
  DEVICE = 'DEVICE',
  DATE = 'DATE',
}

enum UninstallColumn {
  SLOT = 'SLOT',
  DEVICE = 'DEVICE',
}

const debug = dbg('import-xlsx');

const readFile = util.promisify(fs.readFile);

// tslint:disable:no-console
const info = console.info;
const warn = console.warn;
const error = console.error;

const USR = auth.RoleScheme.USR;

const approvedAreas = new Array<string>();
const approvedDepts = new Array<string>();
const approvedNames = new Array<RegExp>();

const SLOT_NAME_REGEX = /^[^\W_]+_[^\W_]+(:[^\W_]+_[^\W_]+)?$/;
const DRR_REGEX = /^DRR[\d?]?[\d?]?(-[\w?]+)?$/;
const ARR_REGEX = /^ARR[\d?]?[\d?]?(-[\w?]+)?$/;
const DEVICE_TYPE_REGEX = /^\w+$/;
const DEVICE_NAME_REGEX = /^[A-Z]\d{5}-[A-Z]{3}-\d{4}-\d{4}(-S\d{5})?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MACHINE_MODE_REGEX = /^M\d_\d\d$/;

let forgClient: forgapi.IClient;

async function main() {

  const cfg: Config = {
    mongo: {
      port: '27017',
      addr: 'localhost',
      db: 'runcheck-dev',
      options: {
        // Use the "new" URL parser (Remove deprecation warning in Mongoose 5.x!)
        useNewUrlParser: true,
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
    for (const file of cfg.configs) {
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

  const updateBy = cfg.updateBy ? String(cfg.updateBy).trim().toUpperCase() : '';
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
    for (const group of forgGroups) {
      if (group.type === 'DEPT') {
        approvedDepts.push(group.uid);
        debug('FORG Approved department: %s (%s)', group.uid, group.fullname);
      }
      if (group.type === 'AREA') {
        approvedAreas.push(group.uid);
        debug('FORG Approved area: %s (%s)', group.uid, group.fullname);
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

  let categories = ['system', 'subsystem', 'device-type'];
  if (cfg.pnsapi.categories) {
    if (!Array.isArray(cfg.pnsapi.categories)) {
      error(`Error: PNS API categories must be an array`);
      process.exitCode = 1;
      return;
    }
    categories = cfg.pnsapi.categories.map(String);
  }

  const loadNames = pnsClient.findNames().then((pnsNames) => {
    for (const name of pnsNames) {
      if (name.code && categories.includes(name.category)) {
        const m = name.code.match(/^[A-Z0-9nx]+$/);
        if (!m) {
          warn(`PNS Invalid %s name: '%s' (ignoring)`, name.category, name.code);
          continue;
        }
        const code = name.code.replace(/n/g, '\\d?').replace(/x/g, '[OLE]');
        approvedNames.push(new RegExp(`^${code}$`));
        debug(`PNS Approved %s name: '%s' /%s/`, name.category, name.code, code);
      }
    }
  });

  await Promise.all([loadGroups, loadNames]);

  let slotSheetName: string | undefined;
  let deviceSheetName: string | undefined;
  let installSheetName: string | undefined;
  let uninstallSheetName: string | undefined;

  for (const sheetName of workbook.SheetNames) {
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
    case WorksheetName.UNINSTALL:
      uninstallSheetName = sheetName;
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

  let uninstallResults: UninstallImportResult[] = [];
  if (uninstallSheetName) {
    uninstallResults = await readUninstalls(workbook.Sheets[uninstallSheetName]);
  } else {
    info(`Workbook does not have uninstallation sheet`);
  }

  if (uninstallResults.length === 0) {
    info('Workbook does not have any uninstallation definitions');
  }

  if (hasResultError(slotResults, deviceResults, installResults, uninstallResults)) {
    printResults(slotResults, deviceResults, installResults, uninstallResults);
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
  if (!cfg.mongo.host) {
    cfg.mongo.host = `${cfg.mongo.addr}:${cfg.mongo.port}`;
  }
  mongoUrl +=  `${cfg.mongo.host}/${cfg.mongo.db}`;

  await mongoose.connect(mongoUrl, cfg.mongo.options);

  try {
    const slots = await models.mapByPath('name', Slot.find().exec());

    const modifiedSlots = new Map<string, Slot>();
    for (const result of slotResults) {
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

    const devices = await models.mapByPath('name', Device.find().exec());

    const modifiedDevices = new Map<string, Device>();
    for (const result of deviceResults) {
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

    const installs = await Install.find().exec();

    const modifiedUninstalls = new Array<{ slot: Slot, device: Device, install: Install}>();
    for (const result of uninstallResults) {
      const slot = slots.get(result.uninstall.slotName);
      if (!slot) {
        result.errors.push(`Slot for uninstall, '${result.uninstall.slotName}', not found`);
        continue;
      }
      if (!slot.installDeviceId) {
        result.errors.push(`Slot '${result.uninstall.slotName}' is not installed`);
        continue;
      }
      const device = devices.get(result.uninstall.deviceName);
      if (!device) {
        result.errors.push(`Device for uninstall, '${result.uninstall.deviceName}', not found`);
        continue;
      }
      if (!device.installSlotId) {
        result.errors.push(`Device '${result.uninstall.deviceName}' is not installed`);
        continue;
      }

      if (!slot.installDeviceId.equals(device._id) || !device.installSlotId.equals(slot._id)) {
        result.errors.push(`Device, '${device.name}', not installed in Slot, '${slot.name}'`);
        continue;
      }

      let install: Install | undefined;
      for (const i of installs) {
        if (i.slotId.equals(slot._id) && i.deviceId.equals(device._id)) {
          install = i;
          break;
        }
      }
      if (!install) {
        result.errors.push(`Installation not found for Slot: ${slot.name}, and Device: ${device.name}`);
        continue;
      }
      install.state = 'UNINSTALLING';

      modifiedUninstalls.push({
        slot: slot,
        device: device,
        install: install,
      });
    }

    const modifiedInstalls: Array<{ slot: Slot, device: Device, install: Install }> = [];
    for (const result of installResults) {
      const slot = slots.get(result.install.slotName);
      if (!slot) {
        result.errors.push(`Slot for install, '${result.install.slotName}', not found`);
        continue;
      }
      if (slot.installDeviceId) {
        let uninstalled = false;
        for (const m of modifiedUninstalls) {
          if (m.slot === slot) {
            uninstalled = true;
            break;
          }
        }
        if (!uninstalled) {
          result.errors.push(`Slot '${result.install.slotName}' is already installed`);
          continue;
        }
      }
      const device = devices.get(result.install.deviceName);
      if (!device) {
        result.errors.push(`Device for install, '${result.install.deviceName}', not found`);
        continue;
      }
      if (device.installSlotId) {
        let uninstalled = false;
        for (const m of modifiedUninstalls) {
          if (m.device === device) {
            uninstalled = true;
            break;
          }
        }
        if (!uninstalled) {
          result.errors.push(`Device '${result.install.deviceName}' is already installed`);
          continue;
        }
      }
      if (slot.deviceType !== device.deviceType) {
        result.errors.push(`Slot, '${slot.name}', and Device, '${device.name}', are not the same type`);
        continue;
      }
      const doc: IInstall = {
        slotId: slot._id,
        deviceId: device._id,
        installOn: result.install.installOn,
        installBy: installBy,
        state: 'INSTALLING',
      };
      const install = new Install(doc);
      try {
        await install.validate();
      } catch (err) {
        result.errors.push(String(err));
        continue;
      }

      modifiedInstalls.push({
        slot: slot,
        device: device,
        install: install,
      });
    }

    if (hasResultError(slotResults, deviceResults, installResults, uninstallResults)) {
      printResults(slotResults, deviceResults, installResults, uninstallResults);
      process.exitCode = 1;
      return;
    }

    if (cfg.dryrun !== false && cfg.dryrun !== 'false') {
      printResults(slotResults, deviceResults, installResults, uninstallResults);
      process.exitCode = 1;
      info('DRYRUN DONE');
      return;
    }

    { // start uninstallations
      const prms: Array<Promise<Install>> = [];
      for (const m of modifiedUninstalls) {
        info(`Start uninstallation: ${JSON.stringify(m.install, null, 4)}`);
        prms.push(m.install.save());
      }
      await Promise.all(prms);
    }

    { // update the slot and device for the uninstallation
      const prms: Array<Promise<Slot | Device>> = [];
      for (const m of modifiedUninstalls) {
        // Assigning 'undefined' to the property properly
        // marks it as modified. However, using the
        // 'delete' operator causes this to fail!
        m.slot.installDeviceBy = undefined;
        m.slot.installDeviceOn = undefined;
        m.slot.installDeviceId = undefined;
        info(`Update slot: ${JSON.stringify(m.slot, null, 4)}`);
        prms.push(m.slot.saveWithHistory(auth.formatRole(USR, installBy)));

        m.device.installSlotBy = undefined;
        m.device.installSlotOn = undefined;
        m.device.installSlotId = undefined;
        info(`Update device: ${JSON.stringify(m.device, null, 4)}`);
        prms.push(m.device.saveWithHistory(auth.formatRole(USR, installBy)));
      }
      await Promise.all(prms);
    }

    {
      const prms: Array<Promise<Install>> = [];
      for (const m of modifiedUninstalls) {
        info(`Finish uninstallation: ${m.install.id}`);
        prms.push(m.install.remove());
      }
      await Promise.all(prms);
    }

    {
      const prms: Array<Promise<Slot | Device>> = [];
      for (const slot of modifiedSlots.values()) {
        info(`Save slot: ${JSON.stringify(slot, null, 4)}`);
        prms.push(slot.saveWithHistory(auth.formatRole(USR, installBy)));
      }
      for (const device of modifiedDevices.values()) {
        info(`Save device: ${JSON.stringify(device, null, 4)}`);
        prms.push(device.saveWithHistory(auth.formatRole(USR, installBy)));
      }
      await Promise.all(prms);
    }

    { // start installations
      const prms: Array<Promise<Install>> = [];
      for (const m of modifiedInstalls) {
        info(`Start installation: ${JSON.stringify(m.install, null, 4)}`);
        prms.push(m.install.save());
      }
      await Promise.all(prms);
    }

    { // update the slot and device for the installation
      const prms: Array<Promise<Slot | Device>> = [];
      for (const m of modifiedInstalls) {
        m.slot.installDeviceId = m.install.deviceId;
        m.slot.installDeviceOn = m.install.installOn;
        m.slot.installDeviceBy = m.install.installBy;
        info(`Update slot: ${JSON.stringify(m.slot, null, 4)}`);
        prms.push(m.slot.saveWithHistory(auth.formatRole(USR, installBy)));

        m.device.installSlotId = m.install.slotId;
        m.device.installSlotOn = m.install.installOn;
        m.device.installSlotBy = m.install.installBy;
        info(`Update device: ${JSON.stringify(m.device, null, 4)}`);
        prms.push(m.device.saveWithHistory(auth.formatRole(USR, installBy)));
      }
      await Promise.all(prms);
    }

    { // finish installations
      const prms: Array<Promise<Install>> = [];
      for (const m of modifiedInstalls) {
        m.install.state = 'INSTALLED';
        info(`Finish installation: ${m.install.id}`);
        prms.push(m.install.save());
      }
      await Promise.all(prms);
    }
  } finally {
    await mongoose.disconnect();
  }
}

interface ImportResult {
  slot?: {};
  device?: {};
  install?: {};
  uninstall?: {};
  errors: string[];
}

interface SlotImportResult extends ImportResult {
  slot: ISlot;
}

async function readSlots(worksheet: XLSX.WorkSheet): Promise<SlotImportResult[]> {

  const results: SlotImportResult[] = [];

  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  for (const irow of data) {
    // cast to interface with index signature
    const row = irow as {[k: string]: {} | undefined};

    let name: string | undefined;
    let desc: string | undefined;
    let area: string | undefined;
    let deviceType: string | undefined;
    let careLevel: string | undefined;
    let safetyLevel: string | undefined;
    let machineModes: string | undefined;
    let drr: string | undefined;
    let arr: string | undefined;

    for (const prop in row) {
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
        case SlotColumn.MACHINE_MODES:
          machineModes = String(row[prop]).trim();
          break;
        default:
          warn(`Slot property, '${prop}', is unexpected, ignoring!`);
          break;
        }
      }
    }

    const result: SlotImportResult = {
      slot: {
        name: '',
        desc: '',
        area: '',
        deviceType: '',
        careLevel: CareLevel.LOW,
        safetyLevel: SafetyLevel.NONE,
        arr: '',
        drr: '',
        machineModes: [],
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
    } else if (!deviceType.match(DEVICE_TYPE_REGEX)) {
      result.errors.push(`Slot type, '${deviceType}', is not valid`);
    } else {
      let found = false;
      for (const approvedName of approvedNames) {
        if (approvedName.test(deviceType)) {
          found = true;
        }
      }
      if (!found) {
        warn(`Slot device type, '${deviceType}', is not approved`);
      }
      result.slot.deviceType = deviceType;
    }

    if (!careLevel) {
      result.errors.push('Slot care level is not specified');
    } else {
      // find the index of the specified care level
      const idx = CARE_LEVELS.reduce((p, v, i) => (p !== -1 || v !== careLevel ? p : i), -1);
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
      const idx = SAFETY_LEVELS.reduce((p, v, i) => (p !== -1 || v !== safetyLevel ? p : i), -1);
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
      result.errors.push(`Slot ARR, '${arr}', is not valid`);
    } else {
      result.slot.arr = arr;
    }

    if (machineModes) {
      let machineModesValid = true;
      const splitMachineModes = machineModes.split(/\s*,\s*/);
      for (const mode of splitMachineModes) {
        if (!mode.match(MACHINE_MODE_REGEX)) {
          result.errors.push(`Slot machine mode, '${mode}', is not valid`);
          machineModesValid = false;
        }
      }
      if (machineModesValid) {
        result.slot.machineModes = splitMachineModes;
      }
    }

    results.push(result);
  }

  return results;
}

interface DeviceImportResult extends ImportResult {
  device: IDevice;
}

async function readDevices(worksheet: XLSX.WorkSheet): Promise<DeviceImportResult[]> {
  const results: DeviceImportResult[] = [];

  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  for (const irow of data) {
    // cast to interface with index signature
    const row = irow as {[k: string]: {} | undefined};

    let name: string | undefined;
    let desc: string | undefined;
    let dept: string | undefined;
    let deviceType: string | undefined;

    for (const prop in row) {
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

    const result: DeviceImportResult = {
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
      let found = false;
      for (const approvedName of approvedNames) {
        if (approvedName.test(deviceType)) {
          found = true;
        }
      }
      if (!found) {
        warn(`Device device type, '${deviceType}', is not approved`);
      }
      result.device.deviceType = deviceType;
    }

    results.push(result);
  }

  return results;
}

interface InstallImportResult extends ImportResult {
  install: {
    slotName: string;
    deviceName: string;
    installOn: Date;
  };
}

async function readInstalls(worksheet: XLSX.WorkSheet): Promise<InstallImportResult[]> {
  const results: InstallImportResult[] = [];

  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  for (const irow of data) {
    // cast to interface with index signature
    const row = irow as {[k: string]: {} | undefined};

    let slotName: string | undefined;
    let deviceName: string | undefined;
    let date: string | undefined;

    for (const prop in row) {
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

    const result: InstallImportResult = {
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
      const installOn = new Date(date);
      if (!Number.isFinite(installOn.getTime())) {
        result.errors.push(`Install date, '${date}', is invalid (2)`);
      } else {
        result.install.installOn = installOn;
      }
    }

    results.push(result);
  }

  return results;
}

interface UninstallImportResult extends ImportResult {
  uninstall: {
    slotName: string;
    deviceName: string;
  };
}

async function readUninstalls(worksheet: XLSX.WorkSheet): Promise<UninstallImportResult[]> {
  const results: UninstallImportResult[] = [];

  const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  for (const irow of data) {
    // cast to interface with index signature
    const row =  irow as {[k: string]: {} | undefined};

    let slotName: string | undefined;
    let deviceName: string | undefined;

    for (const prop in row) {
      if (row.hasOwnProperty(prop)) {
        switch (prop.toUpperCase()) {
        case UninstallColumn.SLOT:
          slotName = String(row[prop]).trim().toUpperCase();
          break;
        case UninstallColumn.DEVICE:
          deviceName = String(row[prop]).trim().toUpperCase();
          break;
        default:
          warn(`Uninstall property, '${prop}', is unexpected, ignoring!`);
          break;
        }
      }
    }

    const result: UninstallImportResult = {
      uninstall: {
        slotName: '',
        deviceName: '',
      },
      errors: [],
    };

    if (!slotName) {
      result.errors.push('Uninstall slot name is not specified');
    } else {
      result.uninstall.slotName = slotName;
    }

    if (!deviceName) {
      result.errors.push('Uninstall device name is not specified');
    } else {
      result.uninstall.deviceName = deviceName;
    }

    results.push(result);
  }

  return results;
}


function hasResultError(...importResults: ImportResult[][]): boolean {
  for (const results of importResults) {
    for (const result of results) {
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        return true;
      }
    }
  }
  return false;
}

function printResults(...results: ImportResult[][]) {
  for (const rs of results) {
    for (const r of rs) {
      if (r.slot) {
        info(`Import slot: ${JSON.stringify(r.slot)}`);
      }
      if (r.device) {
        info(`Import device: ${JSON.stringify(r.device)}`);
      }
      if (r.install) {
        info(`Import install: ${JSON.stringify(r.install)}`);
      }
      if (r.uninstall) {
        info(`Import uninstall: ${JSON.stringify(r.uninstall)}`);
      }
      for (const msg of r.errors) {
        error(`Error: ${msg}`);
      }
    }
  }
}



main().catch((err) =>  {
  // ensure non-zero exit code
  if (process.exitCode === 0) {
    process.exitCode = 1;
  }
  error(`Error: ${err}`);
});

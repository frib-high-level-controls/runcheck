
import stream = require('stream');
import readline = require('readline');

import dbg = require('debug');
import mongoose = require('mongoose');
import mysql = require('mysql');
import rc = require('rc');

import {
  Slot,
} from '../app/models/slot';

import {
  Device,
} from '../app/models/device';

import {
  Group,
  IGroup,
} from '../app/models/group';

import {
  IInstall,
  Install,
} from '../app/models/install';

import {
  Checklist,
  ChecklistConfig,
  ChecklistStatus,
  ChecklistSubject,
  IChecklist,
  IChecklistConfig,
  IChecklistStatus,
  isChecklistApproved,
} from '../app/models/checklist';


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
  dryrun?: {};
  host?: {};
  user?: {};
  database?: {};
  areamgrs?: {[key: string]: {} };
  deptmgrs?: {[key: string]: {} };
  ascareas?: {[key: string]: {} };
  ascdepts?: {[key: string]: {} };
  processes?: {[key: string]: {} };
  subjects?: Array<{[key: string]: {}}>;
};


const debug = dbg('import-ccdb');

const info = console.info;
const warn = console.warn;
const error = console.error;

mongoose.Promise = global.Promise;

// Partially wrap the mysql library to use promises.
function mysql_createConnection(options: any) {

  let conn = mysql.createConnection(options);

  function connect() {
    return new Promise((resolve, reject) => {
      conn.connect((err: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  function query(sqlString: string, values: string[]) {
    return new Promise((resolve, reject) => {
      let cb = (err: mysql.IError, results?: any, fields?: mysql.IFieldInfo[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      };
      if (values) {
        conn.query(sqlString, values, cb);
      } else {
        conn.query(sqlString, cb);
      }
    });
  }

  function end() {
    return new Promise((resolve, reject) => {
      conn.end((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  return {
    connect: connect,
    query: query,
    end: end,
  };
};


async function mongoose_connect(cfg: Config): Promise<void> {

  // configure Mongoose (MongoDB)
  let mongoUrl = 'mongodb://';
  if (cfg.mongo.user) {
    mongoUrl += encodeURIComponent(String(cfg.mongo.user));
    if (cfg.mongo.pass) {
      mongoUrl += ':' + encodeURIComponent(String(cfg.mongo.pass));
    }
    mongoUrl += '@';
  }
  mongoUrl += cfg.mongo.addr + ':' + cfg.mongo.port + '/' + cfg.mongo.db;

  // mongoose.connection.on('connected', function () {
  //   log.info('Mongoose default connection opened.');
  // });
  //
  // mongoose.connection.on('error', function (err) {
  //   log.error('Mongoose default connection error: ' + err);
  // });
  //
  // mongoose.connection.on('disconnected', function () {
  //   log.warn('Mongoose default connection disconnected');
  // });

  return mongoose.connect(mongoUrl, cfg.mongo.options);
};


function mongoose_disconnect(): Promise<void> {
  return new Promise((resolve, reject) => {
    mongoose.disconnect().then(resolve, reject);
  });
};


// Example SEDS structure:
// {
//   "meta": {
//     "type":"SedsScalar_String",
//     "protocol":"SEDSv1",
//     "version":"1.0.0"
//   },
//   "data": {
//     "value":"EML FARADAY CUP",
//     "representation":"EML FARADAY CUP"
//   }
// }
function parseSEDS(seds: string) {
  if (!seds) {
    return;
  }
  let data = JSON.parse(seds);
  if (!data.meta) {
    throw new Error('SEDS data missing "meta" block');
  }
  if (!data.data) {
    throw new Error('SEDS data missing "data" block');
  }
  if (data.meta.protocol !== 'SEDSv1') {
    throw new Error('SEDS data unsupported protocol');
  }
  if (data.meta.version !== '1.0.0') {
    throw new Error('SEDS data unsupported version');
  }

  if (data.meta.type === 'SedsScalar_String') {
    if (!data.data.value) {
      throw new Error('SEDS data missing value');
    }
    return data.data.value;
  }

  throw new Error('SEDS data unsupported type: ' + data.meta.type);
};

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
    host: 'localhost',
  };

  rc('import-ccdb', cfg);
  if (cfg.configs) {
    for (let file of cfg.configs) {
      info('Load configuration: %s', file);
    }
  }

  info(JSON.stringify(cfg, null, 4));


  if (cfg.h || cfg.help) {
    info(`Usage: import-ccdb [ options ]

    Options
      --help               display help information
      --host [ccdbhost]    host name of CCDB database (default: localhost)
      --user [username]    user name for CCDB database
      --database [dbname]  name of CCDB database
      --config [rcfile]    load configuration from rcfile
      --dryrun [dryrun]    validate CCDB data (default: true)
    `);
    return;
  }

  if (!cfg.database) {
    warn('No CCDB database name specified');
    return;
  }

  if (!cfg.user) {
    cfg.user = await new Promise<string>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
      rl.question('Username: ', (username) => {
        resolve(username);
        rl.close();
      });
    });
  }

  let password = await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: new stream.Writable({
        write: (chunk, encoding, callback) => {
          callback();
        },
      }),
      terminal: true,
    });
    // Need to print the prompt because the output
    // stream of the readline interface is disabled.
    process.stdout.write('Password: ');
    rl.question('', (passwd) => {
      process.stdout.write('\n');
      resolve(passwd);
      rl.close();
    });
  });

  info('Connecting to CCDB: mysql://%s@%s/%s', cfg.user, cfg.host, cfg.database);

  let connection = mysql_createConnection({
    host     : cfg.host,
    user     : cfg.user,
    password : password,
    database : cfg.database,
    // debug    : true,
    ssl  : {
        // Use this non-default cipher because the server
        // does not support this clients default ciphers.
        ciphers: 'AES128-SHA',
        // The certificate is self-signed. Ignore.
        rejectUnauthorized: false,
    },
  });

  try {
    await connection.connect();
  } catch (err) {
    error(err);
    return;
  }

  info('Connected to CCDB');

  // RowDataPacket {
  //   id: 14051,
  //   description: 'FAST VALVE, 3-3/8" CONFLAT',
  //   modified_at: 2016-11-23T20:10:12.000Z,
  //   modified_by: 'maxwelld',
  //   serial_number: 'T30000-MDE-9003-0061-S00001',
  //   version: 5,
  //   asm_parent: null,
  //   asm_slot: null,
  //   component_type: 10319 }

  // Import Device data

  let devices: { [key: string]: Device } = {};

  // mysql> desc device;
  // +----------------+--------------+------+-----+---------+-------+
  // | Field          | Type         | Null | Key | Default | Extra |
  // +----------------+--------------+------+-----+---------+-------+
  // | id             | bigint(20)   | NO   | PRI | NULL    |       |
  // | description    | varchar(255) | YES  |     | NULL    |       |
  // | modified_at    | datetime     | YES  |     | NULL    |       |
  // | modified_by    | varchar(255) | YES  |     | NULL    |       |
  // | serial_number  | varchar(255) | YES  | UNI | NULL    |       |
  // | version        | bigint(20)   | YES  |     | NULL    |       |
  // | asm_parent     | bigint(20)   | YES  | MUL | NULL    |       |
  // | asm_slot       | bigint(20)   | YES  | MUL | NULL    |       |
  // | component_type | bigint(20)   | YES  | MUL | NULL    |       |
  // +----------------+--------------+------+-----+---------+-------+

  let rows: {};
  try {
    rows = await connection.query(
      `SELECT d.id, d.description, d.serial_number, t.name from device AS d, component_type AS t
          WHERE d.component_type = t.id;`,
      []);
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  if (!Array.isArray(rows)) {
    error('Query result is not an array.');
    connection.end();
    return;
  }

  for (let row of rows) {
    let device = new Device();
    info('Importing device: %s (%s)', row.serial_number, row.description);
    device.name = row.serial_number;
    device.desc = row.description;
    device.deviceType = row.name;

    let props: {};
    try {
      props = await connection.query(
        `SELECT * from property AS p, device_property_value AS pv
            WHERE pv.property = p.id AND pv.device = ?;`,
        [ row.id ]);
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    // RowDataPacket {
    //   id: 14061,
    //   description: 'Another name',
    //   modified_at: 2016-11-23T20:10:12.000Z,
    //   modified_by: 'maxwelld',
    //   name: 'Alias',
    //   value_unique: 'NONE',
    //   version: 2,
    //   data_type: 36,
    //   unit: null,
    //   in_repository: 0,
    //   prop_value: '{"meta":{"type":"SedsScalar_String","protocol":"SEDSv1","version":"1.0.0"},"data":{"value":"EML FARADAY CUP","representation":"EML FARADAY CUP"}}',
    //   device: 14059,
    //   property: 134 }

    if (!Array.isArray(props)) {
      error('Query result is not an array');
      connection.end();
      return;
    }

    for (let prop of props) {
      if (prop.name === 'Alias') {
        device.desc = parseSEDS(prop.prop_value);
        continue;
      }

      if (prop.name === 'DepartmentManager') {
        let value = parseSEDS(prop.prop_value);
        if (cfg.deptmgrs && cfg.deptmgrs[value]) {
          device.dept = String(cfg.deptmgrs[value]);
        }
        continue;
      }

      if (prop.name === 'AssociatedDepartment') {
        let value = parseSEDS(prop.prop_value);
        if (cfg.ascdepts && cfg.ascdepts[value]) {
          device.dept = String(cfg.ascdepts[value]);
        }
        continue;
      }
    }

    try {
      await device.validate();
    } catch (err) {
      console.error(err);
      console.error(props);
      console.error(device);
      connection.end();
      return;
    }

    devices[row.serial_number] = device;
  }

  // Import device data

  let slots: { [key: string]: Slot } = {};

  // mysql> desc slot;
  // +-----------------+--------------+------+-----+---------+-------+
  // | Field           | Type         | Null | Key | Default | Extra |
  // +-----------------+--------------+------+-----+---------+-------+
  // | id              | bigint(20)   | NO   | PRI | NULL    |       |
  // | comment         | varchar(255) | YES  |     | NULL    |       |
  // | description     | varchar(255) | YES  |     | NULL    |       |
  // | is_hosting_slot | tinyint(1)   | YES  | MUL | 0       |       |
  // | modified_at     | datetime     | YES  |     | NULL    |       |
  // | modified_by     | varchar(255) | YES  |     | NULL    |       |
  // | name            | varchar(255) | YES  | MUL | NULL    |       |
  // | version         | bigint(20)   | YES  |     | NULL    |       |
  // | asm_parent      | bigint(20)   | YES  | MUL | NULL    |       |
  // | asm_slot        | bigint(20)   | YES  | MUL | NULL    |       |
  // | cm_group        | bigint(20)   | YES  | MUL | NULL    |       |
  // | component_type  | bigint(20)   | YES  | MUL | NULL    |       |
  // +-----------------+--------------+------+-----+---------+-------+

  try {
    rows = await connection.query(
      `SELECT s.id, s.name, s.description, t.name AS type from slot AS s, component_type AS t
        WHERE s.component_type = t.id;`,
      []);
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  if (!Array.isArray(rows)) {
    error('Query result is not an array.');
    connection.end();
    return;
  }

  for (let row of rows) {
    if (row.type === '_GRP' || row.type === '_ROOT') {
      info('Skipping slot: %s', row.name);
      continue;
    }

    info('Importing slot: %s', row.name);
    let slot = new Slot();
    slot.name = row.name;
    slot.desc = row.description;
    slot.deviceType = row.type;

    let props = {};
    try {
      props = await connection.query(
        `SELECT * from property AS p, slot_property_value AS pv
          WHERE pv.property = p.id AND pv.slot = ?;`,
        [ row.id ]);
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    if (!Array.isArray(props)) {
      error('Query result is not an array');
      connection.end();
      return;
    }

    for (let prop of props) {

      if (prop.name === 'AreaManager') {
        let value = parseSEDS(prop.prop_value);
        if (value) {
          if (cfg.areamgrs && cfg.areamgrs[value]) {
            slot.area = String(cfg.areamgrs[value]);
          }
        } else {
          info(`AreaManager not specified: using 'AREA??'`);
          slot.area = 'AREA??';
        }
        continue;
      }

      if (prop.name === 'AssociatedArea') {
        let value = parseSEDS(prop.prop_value);
        if (value) {
          if (cfg.ascareas && cfg.ascareas[value]) {
            slot.area = String(cfg.ascareas[value]);
          }
        } else {
          info(`AssociatedArea not specified: using 'AREA??'`);
          slot.area = 'AREA??';
        }
        continue;
      }

      if (prop.name === 'LevelOfCare') {
        slot.careLevel = parseSEDS(prop.prop_value).toUpperCase();
      }

      if (prop.name === 'AssociatedDRR') {
        let value = parseSEDS(prop.prop_value);
        if (value) {
          slot.drr = String(value);
        } else {
          info(`AssociatedDRR not specified: using 'DRR??'`);
          slot.drr = 'DRR??';
        }
        continue;
      }

      if (prop.name === 'AssociatedARR') {
        let value = parseSEDS(prop.prop_value);
        if (value) {
          slot.arr = String(value);
        } else {
          info(`AssociatedARR not specified: using 'ARR??'`);
          slot.arr = 'ARR??';
        }
        continue;
      }
    }

    try {
      await slot.validate();
    } catch (err) {
      error(err);
      error(props);
      error(slot);
      connection.end();
      return;
    }

    slots[row.name] = slot;
  }

  // Import Slot Groups

  // mysql> desc cl_slot_group;
  // +-------------+--------------+------+-----+---------+-------+
  // | Field       | Type         | Null | Key | Default | Extra |
  // +-------------+--------------+------+-----+---------+-------+
  // | id          | bigint(20)   | NO   | PRI | NULL    |       |
  // | description | varchar(255) | YES  |     | NULL    |       |
  // | modified_at | datetime     | YES  |     | NULL    |       |
  // | modified_by | varchar(255) | YES  |     | NULL    |       |
  // | name        | varchar(255) | YES  | UNI | NULL    |       |
  // | version     | bigint(20)   | YES  |     | NULL    |       |
  // | owner       | bigint(20)   | YES  | MUL | NULL    |       |
  // +-------------+--------------+------+-----+---------+-------+

  let groups: { [key: string]: Group | undefined } = {};

  try {
    rows = await connection.query(
      `SELECT g.id, g.name, g.description FROM cl_slot_group AS g;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    info('Importing slot group: %s', row.name);
    let group = new Group(<IGroup> {
      name: row.name,
      desc: row.description,
      // Temporary value to pass validation
      owner: 'UNKNOWN',
      memberType: Slot.modelName,
      safetyLevel: 'NORMAL',
    });

    try {
      await group.validate();
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    groups[row.name] = group;
  }

  try {
    rows = await connection.query(
      `SELECT s.name AS slot_name, g.name AS slot_group_name
        FROM slot AS s, cl_slot_group AS g
        WHERE s.cm_group = g.id;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    let group = groups[row.slot_group_name];
    if (!group) {
      error('Group name found with name: %s', row.slot_group_name);
      connection.end();
      return;
    }

    let slot = slots[row.slot_name];
    if (!slot) {
      error('Slot name found with name: %s', row.slot_name);
      connection.end();
      return;
    }

    // Set the group owner with the slot area
    group.owner = slot.area;

    slot.groupId = group._id;
  }


  // Import Checklist Data

  // mysql> desc cl_checklist;
  // +--------------+--------------+------+-----+---------+-------+
  // | Field        | Type         | Null | Key | Default | Extra |
  // +--------------+--------------+------+-----+---------+-------+
  // | id           | bigint(20)   | NO   | PRI | NULL    |       |
  // | default_list | tinyint(1)   | YES  |     | 0       |       |
  // | description  | varchar(255) | YES  |     | NULL    |       |
  // | for_devices  | tinyint(1)   | YES  |     | 0       |       |
  // | modified_at  | datetime     | YES  |     | NULL    |       |
  // | modified_by  | varchar(255) | YES  |     | NULL    |       |
  // | name         | varchar(255) | YES  | UNI | NULL    |       |
  // | version      | bigint(20)   | YES  |     | NULL    |       |
  // +--------------+--------------+------+-----+---------+-------+

  // mysql> select * from  cl_checklist;
  // +-------+--------------+------------------+-------------+---------------------+-------------+------------------+---------+
  // | id    | default_list | description      | for_devices | modified_at         | modified_by | name             | version |
  // +-------+--------------+------------------+-------------+---------------------+-------------+------------------+---------+
  // | 27556 |            1 | Slot Checklist   |           0 | 2016-07-29 06:22:02 | NULL        | Slot-Checklist   |       1 |
  // | 27557 |            1 | Device checklist |           1 | 2016-07-29 06:22:16 | NULL        | Device-Checklist |       1 |
  // +-------+--------------+------------------+-------------+---------------------+-------------+------------------+---------+

  // mysql> desc cl_process;
  // +-------------+--------------+------+-----+---------+-------+
  // | Field       | Type         | Null | Key | Default | Extra |
  // +-------------+--------------+------+-----+---------+-------+
  // | id          | bigint(20)   | NO   | PRI | NULL    |       |
  // | description | varchar(255) | YES  |     | NULL    |       |
  // | loc         | varchar(255) | YES  |     | NULL    |       |
  // | modified_at | datetime     | YES  |     | NULL    |       |
  // | modified_by | varchar(255) | YES  |     | NULL    |       |
  // | name        | varchar(255) | YES  | UNI | NULL    |       |
  // | version     | bigint(20)   | YES  |     | NULL    |       |
  // +-------------+--------------+------+-----+---------+-------+

  // mysql> select * from cl_process;
  // +-------+------------------------------+------+---------------------+-------------+-----------+---------+
  // | id    | description                  | loc  | modified_at         | modified_by | name      | version |
  // +-------+------------------------------+------+---------------------+-------------+-----------+---------+
  // | 27548 | Device Owner Signoff         | NONE | 2016-07-29 06:19:07 | NULL        | DO-OK     |       2 |
  // | 27549 | Electrical Inspection        | NONE | 2016-07-29 06:19:37 | NULL        | EE-OK     |       1 |
  // | 27550 | Mechanical Inspection        | NONE | 2016-07-29 06:20:08 | NULL        | ME-OK     |       1 |
  // | 27551 | Cryogenics Inspection        | NONE | 2016-07-29 06:20:22 | NULL        | Cryo-OK   |       1 |
  // | 27552 | Controls Inspection          | NONE | 2016-07-29 06:20:32 | NULL        | Ctrls-OK  |       1 |
  // | 27553 | Physics Inspection           | NONE | 2016-07-29 06:20:58 | NULL        | Phys-OK   |       1 |
  // | 27554 | Safety Inspection            | NONE | 2016-07-29 06:21:14 | NULL        | Safety-OK |       2 |
  // | 27555 | Area Manager Signoff         | NONE | 2016-07-29 06:21:26 | NULL        | AM-OK     |       1 |
  // | 27592 | Device Readiness Review      | NONE | 2016-07-29 06:39:43 | NULL        | DRR       |       1 |
  // | 27593 | Accelerator Readiness Review | NONE | 2016-07-29 06:39:52 | NULL        | ARR       |       1 |
  // +-------+------------------------------+------+---------------------+-------------+-----------+---------+

  // mysql> desc cl_status_option;
  // +---------------+--------------+------+-----+---------+-------+
  // | Field         | Type         | Null | Key | Default | Extra |
  // +---------------+--------------+------+-----+---------+-------+
  // | id            | bigint(20)   | NO   | PRI | NULL    |       |
  // | comment_req   | tinyint(1)   | YES  |     | 0       |       |
  // | completed     | tinyint(1)   | YES  |     | 0       |       |
  // | description   | varchar(255) | YES  |     | NULL    |       |
  // | logical_value | tinyint(1)   | YES  |     | 0       |       |
  // | modified_at   | datetime     | YES  |     | NULL    |       |
  // | modified_by   | varchar(255) | YES  |     | NULL    |       |
  // | name          | varchar(255) | YES  |     | NULL    |       |
  // | version       | bigint(20)   | YES  |     | NULL    |       |
  // | weight        | int(11)      | YES  |     | NULL    |       |
  // | checklist     | bigint(20)   | YES  | MUL | NULL    |       |
  // +---------------+--------------+------+-----+---------+-------+

  // mysql> select * from cl_status_option;
  // +-------+-------------+-----------+-------------------+---------------+---------------------+-------------+------+---------+--------+-----------+
  // | id    | comment_req | completed | description       | logical_value | modified_at         | modified_by | name | version | weight | checklist |
  // +-------+-------------+-----------+-------------------+---------------+---------------------+-------------+------+---------+--------+-----------+
  // | 27558 |           0 |         1 | Yes               |             1 | 2016-07-29 06:22:48 | NULL        | Y    |       1 |      1 |     27556 |
  // | 27559 |           1 |         1 | Yes with Comments |             1 | 2016-07-29 06:23:23 | NULL        | YC   |       1 |      0 |     27556 |
  // | 27560 |           0 |         0 | No                |             0 | 2016-07-29 06:23:48 | NULL        | N    |       1 |      0 |     27556 |
  // | 27561 |           0 |         1 | Yes               |             1 | 2016-07-29 06:24:05 | NULL        | Y    |       1 |      1 |     27557 |
  // | 27562 |           1 |         1 | Yes with Comments |             1 | 2016-07-29 06:24:23 | NULL        | YC   |       1 |      0 |     27557 |
  // | 27563 |           0 |         0 | No                |             0 | 2016-07-29 06:24:44 | NULL        | N    |       1 |      0 |     27557 |
  // +-------+-------------+-----------+-------------------+---------------+---------------------+-------------+------+---------+--------+-----------+


  // mysql> desc cl_checklist_field;
  // +----------------+--------------+------+-----+---------+-------+
  // | Field          | Type         | Null | Key | Default | Extra |
  // +----------------+--------------+------+-----+---------+-------+
  // | id             | bigint(20)   | NO   | PRI | NULL    |       |
  // | modified_at    | datetime     | YES  |     | NULL    |       |
  // | modified_by    | varchar(255) | YES  |     | NULL    |       |
  // | optional       | tinyint(1)   | YES  |     | 0       |       |
  // | position       | int(11)      | YES  |     | NULL    |       |
  // | summary_proc   | tinyint(1)   | YES  |     | 0       |       |
  // | version        | bigint(20)   | YES  |     | NULL    |       |
  // | checklist      | bigint(20)   | YES  | MUL | NULL    |       |
  // | default_status | bigint(20)   | YES  | MUL | NULL    |       |
  // | process        | bigint(20)   | YES  | MUL | NULL    |       |
  // | sme            | bigint(20)   | YES  | MUL | NULL    |       |
  // +----------------+--------------+------+-----+---------+-------+

  // mysql> desc cl_assignment;
  // +-------------+--------------+------+-----+---------+-------+
  // | Field       | Type         | Null | Key | Default | Extra |
  // +-------------+--------------+------+-----+---------+-------+
  // | id          | bigint(20)   | NO   | PRI | NULL    |       |
  // | modified_at | datetime     | YES  |     | NULL    |       |
  // | modified_by | varchar(255) | YES  |     | NULL    |       |
  // | version     | bigint(20)   | YES  |     | NULL    |       |
  // | checklist   | bigint(20)   | YES  | MUL | NULL    |       |
  // | device      | bigint(20)   | YES  | MUL | NULL    |       |
  // | requestor   | bigint(20)   | YES  | MUL | NULL    |       |
  // | slot        | bigint(20)   | YES  | MUL | NULL    |       |
  // | slot_group  | bigint(20)   | YES  | MUL | NULL    |       |
  // +-------------+--------------+------+-----+---------+-------+

  // mysql> desc  cl_proc_status;
  // +--------------+--------------+------+-----+---------+-------+
  // | Field        | Type         | Null | Key | Default | Extra |
  // +--------------+--------------+------+-----+---------+-------+
  // | id           | bigint(20)   | NO   | PRI | NULL    |       |
  // | comment      | varchar(255) | YES  |     | NULL    |       |
  // | modified_at  | datetime     | YES  |     | NULL    |       |
  // | modified_by  | varchar(255) | YES  |     | NULL    |       |
  // | version      | bigint(20)   | YES  |     | NULL    |       |
  // | assigned_sme | bigint(20)   | YES  | MUL | NULL    |       |
  // | assignment   | bigint(20)   | YES  | MUL | NULL    |       |
  // | field        | bigint(20)   | YES  | MUL | NULL    |       |
  // | status       | bigint(20)   | YES  | MUL | NULL    |       |
  // +--------------+--------------+------+-----+---------+-------+


  let checklists: {[key: string]: Checklist} = {};

  try {
    rows = await connection.query(
      `SELECT d.serial_number, a.id as assignment_id
        FROM device AS d, cl_assignment AS a
        WHERE d.id = a.device;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    let device = devices[row.serial_number];
    if (!device) {
      error('Device not found for checklist: %s', row.serial_number);
      connection.end();
      return;
    }

    let doc: IChecklist = {
      targetId: device._id,
      targetType: Device.modelName,
      checklistType: 'DEVICE-DEFAULT',
      approved: false,
      checked: 0,
      total: 0,
    };

    info('Import Checklist for Device: %s', device.name);
    let cl = new Checklist(doc);

    device.checklistId = cl._id;

    try {
      await device.validate();
      await cl.validate();
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    checklists[row.assignment_id] = cl;
  }

  try {
    rows = await connection.query(
      `SELECT s.name, a.id AS assignment_id
        FROM slot AS s, cl_assignment AS a
        WHERE s.id = a.slot;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    let slot = slots[row.name];
    if (!slot) {
      error('Slot not found for checklist: %s', row.name);
      connection.end();
      return;
    }

    let doc: IChecklist = {
      targetId: slot._id,
      targetType: Slot.modelName,
      checklistType: 'SLOT-DEFAULT',
      approved: false,
      checked: 0,
      total: 0,
    };

    info('Import Checklist for Slot: %s', slot.name);
    let cl = new Checklist(doc);

    slot.checklistId = cl._id;

    try {
      await slot.validate();
      await cl.validate();
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    checklists[row.assignment_id] = cl;
  }

  try {
    rows = await connection.query(
      `SELECT g.name, a.id AS assignment_id
        FROM cl_slot_group AS g, cl_assignment AS a
        WHERE g.id = a.slot_group;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    let group = groups[row.name];
    if (!group) {
      error('Group not found for checklist: %s', row.name);
      connection.end();
      return;
    }

    let doc: IChecklist = {
      targetId: group._id,
      targetType: Group.modelName,
      checklistType: 'SLOT-DEFAULT',
      approved: false,
      checked: 0,
      total: 0,
    };

    info('Import Checklist for Group: %s', group.name);
    let cl = new Checklist(doc);

    group.checklistId = cl._id;

    try {
      await group.validate();
      await cl.validate();
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    checklists[row.assignment_id] = cl;
  }

  let authUsers: {[key: string]: string | undefined} = {};

  try {
    rows = await connection.query(
      `SELECT u.id, u.user_id FROM auth_user AS u`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    debug('Auth User: %s: %s', row.id, row.user_id);
    authUsers[row.id] = row.user_id;
  }


  let clStatusOptions: {[key: string]: string | undefined} = {};

  try {
    rows = await connection.query(
      `SELECT o.id AS statusOptionId, o.name FROM cl_status_option AS o`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    debug('CL Status Option: %s: %s', row.statusOptionId, row.name);
    clStatusOptions[row.statusOptionId] = row.name;
  }


  let configs: ChecklistConfig[] = [];
  let statuses: ChecklistStatus[] = [];

  for (let clAssignmentId in checklists) {
    if (!checklists.hasOwnProperty(clAssignmentId)) {
      continue;
    }

    let cl = checklists[clAssignmentId];

    try {
      rows = await connection.query(
        `SELECT p.name AS process, s.status, s.comment, s.assigned_sme, s.modified_by, s.modified_at
          FROM cl_checklist_field AS f, cl_process AS p, cl_proc_status AS s
          WHERE s.assignment = ? AND s.field = f.id AND f.process = p.id;`,
        [ clAssignmentId ],
      );
      if (!Array.isArray(rows)) {
        throw new Error('Query result is not an array');
      }
    } catch (err) {
      error(err);
      connection.end();
      return;
    }
    debug('Rows: %s', rows.length);

    for (let row of rows) {
      let subjectName: string | undefined;
      if (cfg.processes && cfg.processes[row.process]) {
        subjectName = String(cfg.processes[row.process]);
      } else {
        error('Subject not found for checklist process: %s', row.process);
        connection.end();
        return;
      }

      let config: ChecklistConfig | undefined;
      let status: ChecklistStatus | undefined;

      let assignedUserId = authUsers[row.assigned_sme];
      debug('CL Assigned SME: %s, for process: %s', assignedUserId || null, row.process);
      if (assignedUserId) {
        // Process has Assigned SME
        let doc: IChecklistConfig = {
          checklistId: cl._id,
          subjectName: subjectName,
          assignees: [ `USR:${assignedUserId.toUpperCase()}` ],
        };
        config = new ChecklistConfig(doc);
        configs.push(config);
      }

      let statusValue = clStatusOptions[row.status];
      info('Import checklist status: %s, for process: %s', statusValue || null, row.process);
      if (!statusValue) {
        // Process is Disabled (N/A)
        if (!config) {
          let doc: IChecklistConfig = {
            checklistId: cl._id,
            subjectName: subjectName,
            required: false,
          };
          config = new ChecklistConfig(doc);
          configs.push(config);
        } else {
          config.required = false;
        }
      } else {
        let doc: IChecklistStatus = {
          checklistId: cl._id,
          subjectName: subjectName,
          value: statusValue,
          comment: row.comment,
          inputAt: row.modified_at,
          inputBy: row.modified_by ? row.modified_by.toUpperCase() : 'SYS:IMPORTCCDB',
        };
        status = new ChecklistStatus(doc);
        statuses.push(status);
      }

      try {
        if (config) {
          await config.validate();
        }
        if (status) {
          await status.validate();
        }
      } catch (err) {
        error(err);
        connection.end();
        return;
      }
    }
  }

  let subjects: ChecklistSubject[] = [];

  if (Array.isArray(cfg.subjects)) {
    for (let doc of cfg.subjects) {
      let subject = new ChecklistSubject(doc);

      try {
        await subject.validate();
      } catch (err) {
        error(err);
        connection.end();
        return;
      }

      subjects.push(subject);
    }
  } else {
    console.warn('No default checklist subjects specified!');
  }

  // Compute checklist summary
  for (let id in checklists) {
    if (checklists.hasOwnProperty(id)) {
      isChecklistApproved(checklists[id], subjects, configs, statuses, true);
      info('Checklist summary: %s, Approved: %s, Checked: %s, Total: %s',
        id, checklists[id].approved, checklists[id].checked, checklists[id].total);
    }
  }

  // Import Installation Data

  // mysql> desc installation_record;
  // +----------------+--------------+------+-----+---------+-------+
  // | Field          | Type         | Null | Key | Default | Extra |
  // +----------------+--------------+------+-----+---------+-------+
  // | id             | bigint(20)   | NO   | PRI | NULL    |       |
  // | install_date   | datetime     | YES  |     | NULL    |       |
  // | modified_at    | datetime     | YES  |     | NULL    |       |
  // | modified_by    | varchar(255) | YES  |     | NULL    |       |
  // | notes          | text         | YES  |     | NULL    |       |
  // | record_number  | varchar(255) | YES  |     | NULL    |       |
  // | uninstall_date | datetime     | YES  |     | NULL    |       |
  // | version        | bigint(20)   | YES  |     | NULL    |       |
  // | device         | bigint(20)   | YES  | MUL | NULL    |       |
  // | slot           | bigint(20)   | YES  | MUL | NULL    |       |
  // +----------------+--------------+------+-----+---------+-------+

  let installs: {[key: string]: Install | undefined} = {};

  try {
    rows = await connection.query(
      `SELECT r.id, s.name, d.serial_number, r.install_date, r.modified_by
        FROM installation_record AS r, device AS d, slot AS s
        WHERE r.device = d.id AND r.slot = s.id;`,
      [],
    );
    if (!Array.isArray(rows)) {
      throw new Error('Query result is not an array');
    }
  } catch (err) {
    error(err);
    connection.end();
    return;
  }

  for (let row of rows) {
    let slot = slots[row.name];
    if (!slot) {
      error('Slot not found: %s', row.name);
      connection.end();
      return;
    }

    let device = devices[row.serial_number];
    if (!device) {
      error('Device not found: %s', row.name);
      connection.end();
      return;
    }

    info('Import Install for Slot: %s, Device: %s', row.name, row.serial_number);
    let install = new Install(<IInstall> {
      slotId: slot._id,
      deviceId: device._id,
      installBy: row.modified_by.toUpperCase(),
      installOn: row.install_date,
      state: 'INSTALLED',
    });

    try {
      await install.validate();
    } catch (err) {
      error(err);
      connection.end();
      return;
    }

    slot.installDeviceId = install.deviceId;
    slot.installDeviceBy = install.installBy;
    slot.installDeviceOn = install.installOn;

    device.installSlotId = install.slotId;
    device.installSlotBy = install.installBy;
    device.installSlotOn = install.installOn;

    installs[row.id] = install;
  }

  // Done! Save the data (if not a dry run)

  await connection.end();

  if (cfg.dryrun !== false && cfg.dryrun !== 'false') {
    info('DRYRUN DONE');
    return;
  }

  try {
    await mongoose_connect(cfg);
  } catch (err) {
    error(err);
    return;
  }

  info('Connected to Runcheck database');

  info('Clear Runcheck database');
  // await mongoose.connection.db.dropDatabase();
  try {
    await Slot.collection.drop();
  } catch (err) {
    console.warn(`WARN: Slot: ${err.message}`);
  }
  try {
    await Device.collection.drop();
  } catch (err) {
    console.warn(`WARN: Device: ${err.message}`);
  }
  try {
    await Group.collection.drop();
  } catch (err) {
    console.warn(`WARN: Group: ${err.message}`);
  }
  try {
    await Install.collection.drop();
  } catch (err) {
    console.warn(`WARN: Install: ${err.message}`);
  }
  try {
    await Checklist.collection.drop();
  } catch (err) {
    console.warn(`WARN: Checklist: ${err.message}`);
  }
  try {
    await ChecklistConfig.collection.drop();
  } catch (err) {
    console.warn(`WARN: ChecklistConfig: ${err.message}`);
  }
  try {
    await ChecklistStatus.collection.drop();
  } catch (err) {
    console.warn(`WARN: ChecklistStatus: ${err.message}`);
  }
  try {
    await ChecklistSubject.collection.drop();
  } catch (err) {
    console.warn(`WARN: ChecklistSubject: ${err.message}`);
  }

  for (let name in devices) {
    if (devices.hasOwnProperty(name)) {
      info('Saving device: %s', name);
      try {
        await devices[name].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let name in slots) {
    if (slots.hasOwnProperty(name)) {
      info('Saving slot: %s', name);
      try {
        await slots[name].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let name in groups) {
    if (groups.hasOwnProperty(name)) {
      info('Saving group: %s', name);
      try {
        let group = groups[name];
        if (group) {
          await group.saveWithHistory('SYS:IMPORTCCDB');
        } else {
          warn('Group not found with name: %s', name);
        }
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let id in installs) {
    if (installs.hasOwnProperty(id)) {
      info('Saving install: %s', id);
      try {
        let install = installs[id];
        if (install) {
          await install.save();
        } else {
          warn('Install not found with id: %s', id);
        }
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let id in checklists) {
    if (checklists.hasOwnProperty(id)) {
      info('Saving checklist: %s', id);
      try {
        await checklists[id].save();
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let id in configs) {
    if (configs.hasOwnProperty(id)) {
      info('Saving checklist config: %s', id);
      try {
        await configs[id].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let id in statuses) {
    if (statuses.hasOwnProperty(id)) {
      info('Saving checklist status: %s', id);
      try {
        await statuses[id].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  for (let id in subjects) {
    if (subjects.hasOwnProperty(id)) {
      info('Saving checklist subject: %s', id);
      try {
        await subjects[id].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        mongoose_disconnect();
        return;
      }
    }
  }

  await mongoose_disconnect();

  info('DONE');
};

main().catch((err) => {
  error(err);
});

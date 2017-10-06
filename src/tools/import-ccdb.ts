
import stream = require('stream');
import readline = require('readline');

import mongoose = require('mongoose');
import mysql = require('mysql');
import rc = require('rc');

import dbg = require('debug');

import slot = require('../app/models/slot');
import device = require('../app/models/device');


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
  ascdepts?: {[key: string]: {} };
};


const debug = dbg('import-ccdb');

const info = console.info;
const warn = console.warn;
const error = console.error;

const Slot = slot.Slot;
const Device = device.Device;

mongoose.Promise = global.Promise;

// Partially wrap the mysql library to use promises.
function mysql_createConnection(options: any) {

  let conn = mysql.createConnection(options);

  let connect = function() {
    return new Promise(function(resolve, reject) {
      conn.connect(function(err: any) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

  let query = function(sqlString: string, values: string[]) {
    return new Promise(function(resolve, reject) {
      let cb = function(err: mysql.IError, results?: any, fields?: mysql.IFieldInfo[]) {
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
  };

  let end = function() {
    return new Promise(function(resolve, reject) {
      conn.end(function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

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
let parseSEDS = function(seds: string) {
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
    cfg.user = await new Promise<string>(function(resolve) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
      rl.question('Username: ', function(username) {
        resolve(username);
        rl.close();
      });
    });
  }

  let password = await new Promise(function(resolve) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: new stream.Writable({
        write: function(chunk, encoding, callback) {
          callback();
        },
      }),
      terminal: true,
    });
    // Need to print the prompt because the output
    // stream of the readline interface is disabled.
    process.stdout.write('Password: ');
    rl.question('', function(passwd) {
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

  let devices: { [key: string]: device.Device } = {};
  // let slots: { [key: string]: slot.Slot } = {};

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

    devices[row.id] = device;
  }

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

  // try {
  //   rows = await connection.query('SELECT s.id, s.name, s.description, t.name AS type from slot AS s, component_type AS t WHERE s.component_type = t.id;', []);
  // } catch (err) {
  //   console.log(err);
  //   return connection.end();
  // }

  // if (!Array.isArray(rows)) {
  //   console.log('Query result is not an array.');
  //   return connection.end();
  // }

  // for (let ridx = 0; ridx < rows.length; ridx += 1) {
  //   row = rows[ridx];
  //   if (row.type === '_GRP' || row.type === '_ROOT') {
  //     console.log('Skipping slot: %s', row.name);
  //     continue;
  //   }

  //   console.log('Importing slot: %s', row.name);
  //   slot = new Slot();
  //   slot.name = row.name;
  //   slot.deviceType = row.type;

  //   try {
  //     let props = await connection.query('SELECT * from property AS p, slot_property_value AS pv WHERE pv.property = p.id AND pv.slot = ?;', [ row.id ]);
  //   } catch (err) {
  //     console.log(err);
  //     return connection.end();
  //   }

  //   if (!Array.isArray(props)) {
  //     console.log('Query result is not an array');
  //     return connection.end();
  //   }

  //   for (let pidx = 0; pidx < props.length; pidx += 1) {
  //     prop = props[pidx];

  //     if (prop.name === 'AreaManager') {
  //       // TODO: convert the format
  //       slot.owner = parseSEDS(prop.prop_value);
  //       continue;
  //     }

  //     if (prop.name === 'AssociatedArea') {
  //       slot.area = parseSEDS(prop.prop_value)
  //       continue;
  //     }

  //     if (prop.name === 'AssociatedDRR') {
  //       // TODO: convert the format
  //       slot.DRR = parseSEDS(prop.prop_value)
  //       continue;
  //     }

  //     if (prop.name === 'AssociatedARR') {
  //       // TODO: convert the format
  //       slot.ARR = parseSEDS(prop.prop_value)
  //       continue;
  //     }
  //   }

  //   try {
  //     await slot.validate();
  //   } catch (err) {
  //     console.error(err);
  //     console.error(slot);
  //     return connection.end();
  //   }

  //   slots[row.id] = slot;
  // }

  //console.log('DONE');
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
  try {
    await mongoose.connection.db.dropDatabase();
  } catch (err) {
    console.error(err);
    return mongoose_disconnect();
  }

  for (let id in devices) {
    if (devices.hasOwnProperty(id)) {
      info('Saving device: %s', devices[id].name);
      try {
        await devices[id].saveWithHistory('SYS:IMPORTCCDB');
      } catch (err) {
        console.error(err);
        return mongoose_disconnect();
      }
    }
  }

  // for (let id in slots) {
  //   if (slots.hasOwnProperty(id)) {
  //     console.log('Saving slot: %s', slots[id].name);
  //     try {
  //       await slots[id].save();
  //     } catch (err) {
  //       console.error(err);
  //       return mongoose_disconnect();
  //     }
  //   }
  // }

  await mongoose_disconnect();

  info('DONE');
};

main().catch((err) => {
  error(err);
});


var stream = require('stream');
var readline = require('readline');

var mongoose = require('mongoose');
var program = require('commander');
var co = require('co');

var debug = require('debug')('import-ccdb')

var Slot = require('../models/slot').Slot;
var Device = require('../models/device').Device;


mongoose.Promise = global.Promise;


// Partially wrap the mysql library to use promises.
var mysql_createConnection = function (options) {
  var conn = require('mysql').createConnection(options);

  var connect = function() {
    return new Promise(function(resolve,reject) {
      conn.connect(function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      })
    });
  };

  var query = function(sqlString, values) {
    return new Promise(function(resolve,reject) {
      var cb = function(err, results, fields) {
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

  var end = function() {
    return new Promise(function(resolve, reject) {
      conn.end(function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      })
    });
  }

  return {
    connect: connect,
    query: query,
    end: end
  }
};


var mongoose_connect = function(options) {

  var mongoOptions = {
    db: {
      native_parser: true
    },
    server: {
      poolSize: 5,
      socketOptions: {
        connectTimeoutMS: 30000,
        keepAlive: 1
      }
    }
  };

  var mongoURL = 'mongodb://' + (options.address || 'localhost') + ':' + (options.port || '27017') + '/' + (options.db || 'runcheck');

  if (options.user && options.pass) {
    mongoOptions.user = options.user;
    mongoOptions.pass = options.pass;
  }

  if (options.auth) {
    mongoOptions.auth = options.auth;
  }

  return new Promise(function (resolve,reject) {
    mongoose.connect(mongoURL, mongoOptions)
      .then(function () {
        resolve();
      }, function (err) {
        reject(err);
      });
  });

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
};


var mongoose_disconnect = function() {
  return new Promise(function(resolve,reject) {
    mongoose.disconnect()
      .then(function() {
        resolve()
      }, function(err) {
        reject(err);
      });
  });
}


// '{"meta":{"type":"SedsScalar_String","protocol":"SEDSv1","version":"1.0.0"},"data":{"value":"EML FARADAY CUP","representation":"EML FARADAY CUP"}}',
var parseSEDS = function(seds) {
  if (!seds) {
    return;
  }
  var data = JSON.parse(seds);
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

//var departmentManagers = {
//  'DepartmentManager-EE':'OWNER'
//}

co(function*() {

  program.version('0.0.1')
    .option('--dryrun', 'only validate data from CCDB')
    .option('-h, --host [ccdbhost]', 'host name of CCDB database', 'localhost')
    .option('-u, --user [username]', 'user name for CCDB database')
    .option('-d, --database [dbname]', 'database name for CCDB');
    //.option('-m, --mongo', 'save data in defoult MongoDB.')
    //.option('-o, --outfile [outfile]', 'save data in specified file.')
    //.option('-c, --config [config]', 'the configuration json file')
    //.arguments('<dataPath>')
    //.action(function (dp) {
    //  dataPath = dp;
    //});
  program.parse(process.argv);

  if (!program.user) {
    program.user = yield new Promise(function(resolve) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });
      rl.question('Username: ', function(username) {
        resolve(username);
        rl.close();
      });
    });
  }

  var password = yield new Promise(function(resolve) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: new stream.Writable({
        write: function(chunk, encoding, callback) {
          callback();
        }
      }),
      terminal: true
    });
    // Need to print the prompt because the output
    // stream of the readline interface is disabled.
    process.stdout.write('Password: ');
    rl.question('', function(password) {
      process.stdout.write('\n');
      resolve(password);
      rl.close();
    });
  });

  console.log('Connecting to CCDB: mysql://%s@%s/%s', program.user, program.host, program.database);

  var connection = mysql_createConnection({
    host     : program.host,
    user     : program.user,
    password : password,
    database : program.database,
    //debug    : true,
    ssl  : {
        // Use this non-default cipher because the server
        // does not support this clients default ciphers.
        ciphers:'AES128-SHA',
        // The certificate is self-signed. Ignore.
        rejectUnauthorized: false
    }
  });

  try {
    yield connection.connect();
  }
  catch(err) {
    console.log(err);
    return;
  }

  console.log('Connected to CCDB');

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

  var rows, row, props, prop, ridx, pidx, id, device, devices = {}, slot, slots = {};

  try {
    rows = yield connection.query('SELECT d.id, d.description, d.serial_number, t.name from device AS d, component_type AS t WHERE d.component_type = t.id;');
  } catch (err) {
    console.log(err);
    return connection.end();
  }

  for (var ridx=0; ridx<rows.length; ridx+=1) {
    row = rows[ridx];
    device = new Device();
    console.log('Importing device: %s (%s)', row.serial_number, row.description);
    device.name = row.description;
    device.serialNo = row.serial_number;
    device.type = row.name;

    try {
      var props = yield connection.query('SELECT * from property AS p, device_property_value AS pv WHERE pv.property = p.id AND pv.device = ?;', [ row.id ]);
    } catch (err) {
      console.log(err);
      return connection.end();
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


    for (var pidx=0; pidx<props.length; pidx+=1) {
      prop = props[pidx];

      //if (props[pidx].name === 'Alias') {
      //  device.name = parseSEDS(props[pidx].prop_value)
      //  console.log('  name = ' + device.name);
      //  continue;
      //}

      if (prop.name === 'DepartmentManager') {
        // TODO: convert the format
        device.owner = parseSEDS(prop.prop_value);
        continue;
      }

      if (prop.name === 'AssociatedDepartment') {
        device.department = parseSEDS(prop.prop_value)
        continue;
      }
    }

    try {
      yield device.validate();
    } catch (err) {
      console.error(err);
      console.error(props);
      console.error(device);
      continue;
      //return connection.end();
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

  try {
    rows = yield connection.query('SELECT s.id, s.name, s.description, t.name AS type from slot AS s, component_type AS t WHERE s.component_type = t.id;');
  } catch (err) {
    console.log(err);
    return connection.end();
  }

  for (var ridx=0; ridx<rows.length; ridx+=1) {
    row = rows[ridx];
    if (row.type === '_GRP' || row.type === '_ROOT') {
      console.log('Skipping slot: %s', row.name);
      continue;
    }

    console.log('Importing slot: %s', row.name);
    slot = new Slot();
    slot.name = row.name;
    slot.deviceType = row.type;

    try {
      var props = yield connection.query('SELECT * from property AS p, slot_property_value AS pv WHERE pv.property = p.id AND pv.slot = ?;', [ row.id ]);
    } catch (err) {
      console.log(err);
      return connection.end();
    }

    for (var pidx=0; pidx<props.length; pidx+=1) {
      prop = props[pidx];

      if (prop.name === 'AreaManager') {
        // TODO: convert the format
        slot.owner = parseSEDS(prop.prop_value);
        continue;
      }

      if (prop.name === 'AssociatedArea') {
        slot.area = parseSEDS(prop.prop_value)
        continue;
      }

      if (prop.name === 'AssociatedDRR') {
        // TODO: convert the format
        slot.DRR = parseSEDS(prop.prop_value)
        continue;
      }

      if (prop.name === 'AssociatedARR') {
        // TODO: convert the format
        slot.ARR = parseSEDS(prop.prop_value)
        continue;
      }
    }

    try {
      yield slot.validate();
    } catch (err) {
      console.error(err);
      console.error(slot);
      return connection.end();
    }

    slots[row.id] = slot;
  }

  //console.log('DONE');
  yield connection.end();

  if (program.dryrun) {
    console.log("DRYRUN DONE");
    return;
  }

  try {
    yield mongoose_connect(require('../config/mongo'));
  } catch(err) {
    console.error(err);
    return;
  }

  console.log('Connected to Runcheck');

  console.log('Clear Runcheck database');
  try {
    yield mongoose.connection.db.dropDatabase();
  } catch (err) {
    console.error(err);
    return mongoose_disconnect();
  }

  for (id in devices) {
    if (devices.hasOwnProperty(id)) {
      console.log('Saving device: %s', devices[id].serialNo);
      try {
        yield devices[id].save();
      } catch (err) {
        console.error(err);
        return mongoose_disconnect();
      }
    }
  }

  for (id in slots) {
    if (slots.hasOwnProperty(id)) {
      console.log('Saving slot: %s', slots[id].name);
      try {
        yield slots[id].save();
      } catch (err) {
        console.error(err);
        return mongoose_disconnect();
      }
    }
  }

  yield mongoose_disconnect();

  console.log('DONE');
});

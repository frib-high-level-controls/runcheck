#!/usr/bin/env node

var config = require('../config/config');
var mongoose = require('mongoose');
var program = require('commander');
var path = require('path');
var fs = require('fs');
var sutil = require('./utils');

// get arguments starts
var dataPath;
var configPath;
program.version('0.0.1')
  .option('-d, --dryrun', 'validate data by schema in MongoDB.')
  .option('-m, --mongo', 'save data in defoult MongoDB.')
  .option('-o, --outfile [outfile]', 'save data in specified file.')
  .option('-c, --config [config]', 'the configuration json file')
  .arguments('<dataPath>')
  .action(function (dp) {
    dataPath = dp;
  });
program.parse(process.argv);
// get arguments end

// if no mongo, then make dry run default
if (!program.mongo) {
  program.dryrun = true;
}

// check dataPath starts
if (dataPath === undefined) {
  console.error('Need the input .xlsx data file path!');
  program.help();
  // process.exit(1);
}
var realDataPath = path.resolve(process.cwd(), dataPath);
if (!fs.existsSync(realDataPath)) {
  console.error(realDataPath + ' does not exist.');
  console.error('invalid .xlsx data file path.');
  process.exit(1);
}
// suffix must be xlsx
var suffix = realDataPath.split('.').pop();
if (suffix !== 'xlsx') {
  console.error('File format must be xlsx.');
  process.exit(1);
}
// check dataPath end


// check configPath starts
configPath = program.config;
if (configPath === undefined) {
  console.error('Need the input config file path!');
  program.help();
  // process.exit(1);
}
var realConfigPath = path.resolve(process.cwd(), configPath);
if (!fs.existsSync(realConfigPath)) {
  console.error(realConfigPath + ' does not exist.');
  console.error('Invalid config file path.');
  process.exit(1);
}
// check configPath end


// check config content starts
var lconfig = require(realConfigPath);
// essential field
var essential = ['name', 'model', 'collection', 'nameMap', 'position'];
for (var i = 0; i < essential.length; i++) {
  if (!lconfig[essential[i]]) {
    console.error(essential[i] + ' is required in config file.');
    process.exit(1);
  }
}
// array field
if (!Array.isArray(lconfig.position)) {
  console.error('configuration sheet field must be array');
  process.exit(1);
}
if (!Array.isArray(lconfig.nameMap)) {
  console.error('configuration nameMap field must be array');
  process.exit(1);
}
// check config content end


// connect mongo starts
var mongoURL = 'mongodb://' + (config.mongo.address || 'localhost') + ':' + (config.mongo.port || '27017') + '/' + (config.mongo.db || 'runcheck');
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
if (config.mongo.user && config.mongo.pass) {
  mongoOptions.user = config.mongo.user;
  mongoOptions.pass = config.mongo.pass;
}

if (config.mongo.auth) {
  mongoOptions.auth = config.mongo.auth;
}

if (program.mongo) {
  mongoose.connection.on('connected', function () {
    console.log('Mongoose default connection opened.');
  });
  mongoose.connection.on('error', function (err) {
    console.error('Mongoose default connection error: ' + err);
  });
  mongoose.connection.on('disconnected', function () {
    console.log('Mongoose default connection disconnected');
    process.exit(0);
  });
}

// connect mongo end


sutil.init(lconfig);
console.log('----------Import Data from xlsx file to MongoDB-------------');
var datalist = sutil.getXlsxJson(realDataPath);
console.log('Get ' + datalist.length + ' entries from ' + realDataPath);

if (program.dryrun) {
  sutil.dataValidate(datalist, function (err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log('All data validation completed successfully.');
    }
    if (program.outfile) {
      sutil.saveFile(datalist, program.outfile);
    }
    console.log('Dryrun end.');
  });
} else {
  if (program.mongo) {
    // save to mongo DB
    // Save Data
    console.log('Start importing Data to MongoDB');
    sutil.saveModel(datalist, function (err, success, count) {
      if(err) {
        console.error(err.message);
      }else {
        console.log('Success: ' + count + ' items were processed, and ' + success + ' were inserted');
      }
      mongoose.connection.close();
    });
    mongoose.connect(mongoURL, mongoOptions);
  }
}

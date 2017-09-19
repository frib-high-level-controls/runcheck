var XLSX = require('xlsx');
var config;
var Model;
var Schema;
var uniqueFields;

function init(c) {
  config = c;
  Model = require('../models/' + config.name)[config.model];
  Schema = Model.schema;
  uniqueFields = getUniqueField();
}


/**
 * delete null or white space field, rename key ,delete non-number characters(unit) in number field
 * @param datalist    the originnale json list from xlsx file
 * @param dataSchema  the data model schema defined by mongoose
 * @param nameMap     model field and original column name mapping
 */
function fieldFixed(datalist, dataSchema, nameMap) {
  datalist.forEach(function (x) {
    nameMap.forEach(function (n) {
      if (x[n[1]] !== undefined) {
        // delete '' or ' '
        if (x[n[1]].length === 0 || !x[n[1]].replace(/\s/g, '').length) {
          delete x[n[1]];
          return
        }
        // rename key
        x[n[0]] = x[n[1]];
        delete x[n[1]];
        // delete non-number characters(unit) in number field
        if (dataSchema.paths[n[0]].instance === 'Number') {
          x[n[0]] = x[n[0]].replace(/[^\+\-0-9\.]+/g, '');
        }
      }
    })
  });
}


/**
 * filter
 * @param x
 * @returns {boolean}
 */
function filtByField(x) {
  var field = config.filterField;
  var v = true;
  for (var i = 0; i < field.length; i++) {
    v = v && x[field[i]];
  }
  return v;
}


/**
 * convert data in xlsx to json format, each sheet will be handled
 * @param fileName
 * @returns {Array}
 */
function getXlsxJson(fileName) {
  // Read data from sheet
  var workbook = XLSX.readFile(fileName);
  var data = [];
  config.position.forEach(function (p) {
    var branch = workbook.Sheets[p.sheet];
    if (!branch) {
      console.error('Cannot read data from sheet ' + p.sheet + ', please check the config file.');
      process.exit(1);
    }
    branch['!ref'] = p.range;
    var l = XLSX.utils.sheet_to_json(branch);
    data = data.concat(l);
  });
  if (data.length === 0) {
    console.error('Cannot convert data to valid json list, please check the config file.');
    process.exit(1);
  }

  fieldFixed(data, Schema, config.nameMap);
  if (config.filterField) {
    data = data.filter(filtByField);
  }
  return data;
}


/**
 * get unique fields by schema
 * @returns {Array}
 */
function getUniqueField() {
  var uniqueFields = [];
  for (var a in Schema.paths) {
    if (Schema.paths[a].options.unique) {
      uniqueFields.push(a);
    }
  }
  return uniqueFields;
}

// get identity as show name


/**
 * remove the duplicate entries and validate field format by schema.
 * @param oridatalist    json object list
 * @param callback
 */
function dataValidate(datalist, callback) {
  console.log('check unique fields');
  var dupFields = null;
  uniqueFields.forEach(function (f) {
    var values = [];
    var i;
    for (i = 0; i < datalist.length; i += 1) {
      if (values.indexOf(datalist[i][f]) === -1) {
        values.push(datalist[i][f]);
      } else {
        if (!dupFields) {
          dupFields = {};
        }
        if (!dupFields[f]) {
          dupFields[f] = [];
        }
        if (dupFields[f].indexOf(datalist[i][f]) === -1) {
          dupFields[f].push(datalist[i][f]);
        }
      }
    }
  });
  if (dupFields) {
    if (typeof callback === 'function') {
      return callback(new Error('Duplicate fields found: ' + JSON.stringify(dupFields)));
    } else {
      return console.error('Duplicate fields found: ' + JSON.stringify(dupFields));
    }
  } else {
    console.log('all values in unique fields are unique.');
  }

  console.log('Schema validation start.');
  var errs = [];
  var i;
  for (i = 0; i < datalist.length; i++) {
    var sobj = new Model(datalist[i]);
    var err = sobj.validateSync();
    if (err) {
      console.error('Validate failed for ' + sobj);
      console.error(err.errors);
      errs.push(err);
    }
  }

  if (errs.length > 0) {
    if (typeof callback === 'function') {
      return callback(new Error(errs.length + ' items are invalid.'));
    } else {
      return console.error(errs.length + ' items are invalid.');
    }
  } else {
    console.log('all data passed the schema validation.');
  }
  if (typeof callback === 'function') {
    return callback(null);
  }
}

/**
 * save data to file
 * @param data    the validated json object list
 * @param fname   the file name
 */
function saveFile(data, fname) {
  var fs = require('fs');
  fs.writeFile(fname, JSON.stringify(data, null, 2), function (err) {
    if (err) {
      return console.error(err.message);
    }
    console.log('The data are saved in ' + fname);
  });
}


/**
 * Make sure indexes are built successfully, then save data to MongoDB
 * @param data     the validated json object list
 * @param callback
 */
function saveModel(datalist, callback) {
  var indexTriggered = false;
  Model.on('index', function(err) {
    indexTriggered = true;
    if(err) {
      return callback(err);
    }
    var i;
    var count = 0;
    var success = 0;
    if (datalist.length === 0) {
      if (typeof callback === 'function') {
        return callback(null, 0, 0);
      }
    }
    for (i = 0; i < datalist.length; i += 1) {
      var m = new Model(datalist[i]);
      var error = null;
      m.save(function (err) {
        if (err) {
          console.error(err.message);
        } else {
          success += 1;
        }
        count += 1;
        if (count === datalist.length) {
          if (typeof callback === 'function') {
            if (success != count) {
              error = new Error('Failed: ' + count + ' items were processed, but only ' + success + ' were inserted');
            }
            return callback(error, success, count);
          }
        }
      });
    }
  });
  var timeout = setTimeout(function () {
    if (indexTriggered) {
      clearTimeout(timeout);
    } else {
      console.log('30 seconds passed, and not index event triggered. Give up now.');
      callback(new Error('no index event within 30 seconds.'));
    }
  }, 30000);
}

module.exports = {
  init: init,
  getXlsxJson: getXlsxJson,
  dataValidate: dataValidate,
  saveFile: saveFile,
  saveModel: saveModel
};

var _ = require('lodash');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
var addHistory = require('./history').addHistory;

var checklistValues = ['N', 'Y', 'YC'];

var checklistTypes = [ 'device', 'beamline-slot', 'safety-slot' ];


// A checklistItem represents single item of a checklist:
//   type: the checklist type to which this item belongs
//   subject: name of the subject of this checklist item
//   checklist: the specific checklist to which this item belongs
//   order: the order in which this item should be rendered
//   assignee: the role to which this item is assigned
//   required: indicates if this item must be completed
//   mandatory: indicates if this item must be required
//   final: indicates of this item finalizes the checklist
var checklistItem = Schema({
  type: {
    type: String,
    required: true,
    enum: checklistTypes
  },
  subject: {
    type: String,
    required: true
  },
  checklist: {
    type: ObjectId,
    default: null
  },
  order: {
    type: Number,
    default: 0 
  },
  assignee: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: true
  },
  mandatory: {
    type: Boolean,
    default: false
  },
  final: {
    type: Boolean,
    default: false
  }
});


checklistItem.statics.applyCfg = function(item, cfg) {
  if (item && cfg) {
    if (_.isString(cfg.subject)) {
      item.subject = cfg.subject;
    }
    if (_.isString(cfg.assignee)) {
      item.assignee = cfg.assignee;
    }
    if (_.isBoolean(cfg.required)) {
      item.required = cfg.required;
    }
    if (_.isArray(cfg.__updates)) {
      console.log("Found Cfg updates!");
      if (item.__updates) {
        console.log("Apply Cfg updates! (concat)" + cfg.__updates.length);
        item.__updates = item.__updates.concat(cfg.__updates);
      } else {
        console.log("Apply Cfg updates! (splice)" + cfg.__updates.length);
        item.__updates = cfg.__updates.splice();
      }
    }
  }
  return item;
}

checklistItem.methods.applyCfg = function(cfg) {
  return checklistItem.statics.applyCfg(this, cfg);
}

checklistItem.plugin(addHistory, {
  fieldsToWatch: ['subject']
});

var ChecklistItem = mongoose.model('ChecklistItem', checklistItem);



// A checklistItemCfg is configuration for a checklist item.
//   checklist: the checklist to which this configuration belongs
//   item: the checklist item to which this configuration applies
//   subject: alternative subject to override the item
//   assignee: user id of person required to respond to this item
//   required: indicate if the item must have a response
var checklistItemCfg = Schema({
  checklist: {
    type: ObjectId,
    required: true
  },
  item: {
    type: ObjectId,
    required: true
  },
  subject: {
    type: String,
    default: null
  },
  assignee: {
    type: String,
    default: null
  },
  required: {
    type: Boolean,
    default: null
  }
});

checklistItemCfg.plugin(addHistory, {
  fieldsToWatch: ['subject', 'assignee', 'required' ]
});

var ChecklistItemCfg = mongoose.model('ChecklistItemCfg', checklistItemCfg);


// A checklistItemData is the response for a checklist item.
//  checklist: the checklist to which this response belongs
//  item: the checklist item to which this response applies
//  value: the value of the input
//  comment: extra information
//  inputOn: date when the input was submitted
//  inputBy: user id of the persion who submitted the input
var checklistItemData = Schema({
  checklist: {
    type: ObjectId,
    required: true
  },
  item: {
    type: ObjectId,
    required: true
  },
  value: {
    type: String,
    required: true,
    enum: checklistValues
  },
  comment: {
    type: String,
    default: ''
  },
  inputOn: {
    type: Date,
    required: true
  },
  inputBy: {
    type: String,
    required: true
  }
});

checklistItemData.plugin(addHistory, {
  fieldsToWatch: ['value', 'comment']
});

var ChecklistItemData = mongoose.model('ChecklistItemData', checklistItemData);


// A checklist is a list of responses for various subjects
//  target: the object to which this checklist belongs
//  type: the type of this checklist
var checklist = Schema({
  target: {
    type: ObjectId,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: checklistTypes
  }
  // Consider adding checklist completion information from device
  //, checkedValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0
  // },
  // totalValue: {
  //   type: Number,
  //   default: 0,
  //   min: 0
  // }
});


// checklist.plugin(addHistory, {
//   fieldsToWatch: ['items']
// });

var Checklist = mongoose.model('Checklist', checklist);


module.exports = {
  // enums
  checklistValues: checklistValues,
  checklistTypes: checklistTypes,
  // models
  Checklist: Checklist,
  ChecklistItem: ChecklistItem,
  ChecklistItemCfg: ChecklistItemCfg,
  ChecklistItemData: ChecklistItemData,
};

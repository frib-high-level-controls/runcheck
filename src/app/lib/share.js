var ad = require('../../config/config').ad;
var ldapClient = require('./ldap-client');

var mongoose = require('mongoose');

var User = mongoose.model('User');

/*function addUserFromAD(req, res, doc) {
  var name = req.body.name;
  var nameFilter = ad.nameFilter.replace('_name', name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err.name + ' : ' + err.message);
      return res.json(500, err);
    }

    if (result.length === 0) {
      return res.send(400, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName.toLowerCase();
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    doc.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access
    });
    doc.save(function (docErr) {
      if (docErr) {
        console.error(docErr);
        return res.send(500, docErr.message);
      }
      var user = new User({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber,
        mobile: result[0].mobile
      });
      switch (doc.constructor.modelName) {
      case 'Form':
        user.forms = [doc._id];
        break;
      case 'Traveler':
        user.travelers = [doc._id];
        break;
      case 'Binder':
        user.binders = [doc._id];
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      user.save(function (userErr) {
        if (userErr) {
          console.error(userErr);
        }
      });
      return res.send(201, 'The user named ' + name + ' was added to the share list.');
    });
  });
}*/


/*function addUser(req, res, doc) {
  var name = req.body.name;
  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (user) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      doc.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      doc.save(function (docErr) {
        if (docErr) {
          console.error(docErr);
          return res.send(500, docErr.message);
        }
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      });
      var addToSet = {};
      switch (doc.constructor.modelName) {
      case 'Form':
        addToSet.forms = doc._id;
        break;
      case 'Traveler':
        addToSet.travelers = doc._id;
        break;
      case 'Binder':
        addToSet.binders = doc._id;
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      user.update({
        $addToSet: addToSet
      }, function (useErr) {
        if (useErr) {
          console.error(useErr);
        }
      });
    } else {
      addUserFromAD(req, res, doc);
    }
  });
}*/

function changeOwner(req, res, doc) {
  // get user id from name here
  var name = req.body.name;
  var nameFilter = ad.nameFilter.replace('_name', name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (ldapErr, result) {
    if (ldapErr) {
      console.error(ldapErr.name + ' : ' + ldapErr.message);
      return res.send(500, ldapErr.message);
    }

    if (result.length === 0) {
      return res.send(400, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName.toLowerCase();

    if (doc.owner === id) {
      return res.send(204);
    }

    doc.owner = id;
    doc.transferredOn = Date.now();

    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'Owner is changed to ' + id);
    });
  });
}

module.exports = {
  changeOwner: changeOwner
};

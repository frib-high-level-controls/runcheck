/*
 * Authenication support library
 */


/*
 * Stub implementation that denies all requests
 */
function ensureAuthenticated(req, res, next) {
  module.exports.ensureAuthcHandler(req, res, next);
}

function ensureAuthcHandler(req, res) {
  return res.status(401).send('not authenticated');
}

function sessionLocals(req, res, next) {
  res.locals.session = req.session;
  next();
}

/*
 * Check that current user session contains the specified role
 */
function verifyRole(role) {
  return function (req, res, next) {
    if (req.session.roles) {
      if (req.session.roles[role]) {
        return next();
      } else {
        return res.status(403).send('You are not authorized to access this resource. ');
      }
    } else {
      log.warn('Cannot find the user\'s role.');
      return res.status(500).send('something wrong for the user\'s session');
    }
  };
}

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
  ensureAuthcHandler: ensureAuthcHandler,
  sessionLocals: sessionLocals,
  verifyRole: verifyRole
}

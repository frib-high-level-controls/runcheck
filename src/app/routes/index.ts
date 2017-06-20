/**
 *  Route handlers for index.
 */
import express = require('express');

import log = require('../lib/log');
import auth = require('../lib/auth');
import handlers = require('../shared/handlers');

export let redirectUrl: string;

export const router = express.Router();

const catchAll = handlers.catchAll;
const HttpStatus = handlers.HttpStatus;


/* GET home page. */
router.get('/', catchAll(async (req, res) => {
  res.render('index', { title: 'Express' });
}));

router.get('/login', auth.ensureAuthenticated, catchAll(async (req, res) => {
  if (req.session && req.session.userid) {
    res.redirect('/');
    return;
  }
  // something is wrong
  res.status(HttpStatus.BAD_REQUEST).send('please enable cookie in your browser');
}));

/* GET logout page */
router.get('/logout', catchAll(async (req, res) => {
  await new Promise((resolve, reject) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          log.error('Error destroying session: %s', err);
        }
        resolve();
      });
    } else {
      log.warn('Session not found on logout');
      resolve();
    }
  });

  res.redirect(redirectUrl || '/');
}));

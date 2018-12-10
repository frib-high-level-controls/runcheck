/**
 * Router that handles to render views.
 */
import * as express from 'express';

const router = express.Router();

export function getRouter(opts?: {}): express.Router {
  return router;
}

router.get('/reports/machmodes', (req, res) => {
  res.render('machmodes');
});

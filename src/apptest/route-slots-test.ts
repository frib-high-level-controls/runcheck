/**
 * Tests for slots routes.
 */

/* tslint:disable:max-line-length */

import { AssertionError } from 'assert';

import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

import { Device } from '../app/models/device';
import { Slot } from '../app/models/slot';

import * as app from './app';
import * as data from './data';

// Utility to get an authenticated agent for the specified user.
async function requestFor(app: express.Application, username?: string, password?: string) {
  const agent = request.agent(app);
  if (username) {
    await agent
      .get('/login')
      .auth(username, password || 'Pa5w0rd')
      .expect(302);
  }
  return agent;
};

async function getSlotNameOrId(r: { name: string, by: string }) {
  if (r.by === 'ID') {
    let slot = await Slot.findOne({ name: r.name}).exec();
    if (!slot || !slot.id) {
      throw new AssertionError({ message: `Slot not found with name: ${r.name}` });
    }
    return slot.id;
  }
  return r.name;
}

async function getDeviceId(r: { device: string }) {
  let device = await Device.findOne({ name: r.device }).exec();
  if (!device || !device.id) {
    throw new AssertionError({ message: `Device not found with name: ${r.device}`});
  }
  return device.id;
}

function expectPackage(data?: {}) {
  return (res: request.Response) => {
    if (res.status < 300 || res.status >= 400) {
      let pkg = <webapi.Pkg<{}>> res.body;
      assert.isObject(pkg);
      if (res.status < 300) {
        assert.isObject(pkg.data);
        assert.isUndefined(pkg.error);
        if (data) {
          // For some reason this function, deepInclude(),
          // is not in the type definitions (@types/chai@4.0.5)!
          (<any> assert).deepInclude(pkg.data, data);
        }
      } else {
        assert.isObject(pkg.error);
        assert.isNumber((<any> pkg.error).code);
        assert.isString((<any> pkg.error).message);
        assert.isNotEmpty((<any> pkg.error).message);
      }
    }
  };
}

describe('Test slot routes', () => {

  let handler: express.Application;

  before(async () => {
    // Start the application
    handler = await app.start();
    // Initialize the test data
    await data.initialize();
   });

  after(async () => {
    await app.stop();
  });

  describe('Get slot data', () => {
    let table = [
      { name: 'FE_TEST:DEVA_D0001', user: '', by: 'name' },
      { name: 'FE_TEST:DEVA_D0001', user: '', by: 'ID' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', by: 'name' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', by: 'ID' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', by: 'name' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', by: 'ID' },
      { name: 'FE_TEST:DEVB_D0002', user: '', by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', user: '', by: 'ID' },
      { name: 'FE_TEST:DEVB_D0002', user: 'FEDM', by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', user: 'FEDM', by: 'ID' },
      { name: 'FE_TEST:DEVB_D0002', user: 'FEAM', by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', user: 'FEAM', by: 'ID' },
    ];

    for (let row of table) {
      it( `User ${row.user || 'anonymous'} get slot (${row.name}) by ${row.by}`, async () => {
        const nameOrId = await getSlotNameOrId(row);
        const agent = await requestFor(handler, row.user);
        return agent
          .get(`/slots/${nameOrId}`)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(expectPackage({ name: row.name }));
      });
    }
  });

  describe('Install device', () => {
    let table = [
      // User unauthenticated
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: '', status: 302, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: '', status: 302, by: 'ID' },
      // User unauthorized
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEDM', status: 403, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEDM', status: 403, by: 'ID' },
      // Device type incompatible
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 400, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 400, by: 'ID' },
      // Installation date missing or invalid
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: undefined,    user: 'FEAM', status: 400, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '',           user: 'FEAM', status: 400, by: 'ID' },
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: '2017',       user: 'FEAM', status: 400, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-13-20', user: 'FEAM', status: 400, by: 'ID' },
      // Installation OK
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 200, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 200, by: 'ID' },
      // Already installed
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 400, by: 'name' },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 400, by: 'ID' },

    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}', install device (${row.device} => ${row.name}) by ${row.by}`, async () => {
        const nameOrId = await getSlotNameOrId(row);
        const deviceId = await getDeviceId(row);
        const agent = await requestFor(handler, row.user);
        return agent
          .put(`/slots/${nameOrId}/installation`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: {
              installDeviceId: deviceId,
              installDeviceOn: row.date,
            }
          })
          .expect(row.status)
          .expect(expectPackage({ installDeviceOn: row.date }));
      });
    }
  });

});

/**
 * Tests for devices routes.
 */

/* tslint:disable:max-line-length */

import { AssertionError } from 'assert';

import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

import { Device } from '../app/models/device';

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

async function getDeviceNameOrId(r: { name: string, by: string }) {
  if (r.by === 'ID') {
    let device = await Device.findOne({ name: r.name}).exec();
    if (!device || !device.id) {
      throw new AssertionError({ message: `Device not found with name: ${r.name}` });
    }
    return device.id;
  }
  return r.name;
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


describe('Test device routes', () => {

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

  describe('Get device data', () => {
    let table = [
      { name: 'T99999-DEVA-0009-0099-S00001', user: '', by: 'name' },
      { name: 'T99999-DEVA-0009-0099-S00001', user: '', by: 'ID' },
      { name: 'T99999-DEVA-0009-0099-S00001', user: 'FEDM', by: 'name' },
      { name: 'T99999-DEVA-0009-0099-S00001', user: 'FEDM', by: 'ID' },
      { name: 'T99999-DEVA-0009-0099-S00001', user: 'FEAM', by: 'name' },
      { name: 'T99999-DEVA-0009-0099-S00001', user: 'FEAM', by: 'ID' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: '', by: 'name' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: '', by: 'ID' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: 'FEDM', by: 'name' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: 'FEDM', by: 'ID' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: 'FEAM', by: 'name' },
      { name: 'T99999-DEVB-0009-0099-S00002', user: 'FEAM', by: 'ID' },
    ];

    for (let row of table) {
      it( `User ${row.user || 'anonymous'} get device (${row.name}) by ${row.by}`, async () => {
        const nameOrId = await getDeviceNameOrId(row);
        const agent = await requestFor(handler, row.user);
        return agent
          .get(`/devices/${nameOrId}`)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(expectPackage({ name: row.name }));
      });
    }
  });

});

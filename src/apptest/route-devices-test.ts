/**
 * Tests for devices routes.
 */

/* tslint:disable:max-line-length */

import { AssertionError } from 'assert';

import * as express from 'express';

import { Device } from '../app/models/device';

import {
  expectPackage,
  requestFor,
} from './shared/testing';

import * as app from './app';
import * as data from './data';


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

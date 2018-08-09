/**
 * Tests for slots routes.
 */

/* tslint:disable:max-line-length */

//import { AssertionError } from 'assert';

import * as express from 'express';
import * as supertest from 'supertest';

//import { Device } from '../app/models/device';
//import { Slot } from '../app/models/slot';

import {
  expectPackage,
  //requestFor,
} from './shared/testing';

import {
  checkValid,
} from './shared/jsonschema';

import * as app from './app';
import * as data from './data';


// async function getSlotNameOrId(r: { name: string, by: string }) {
//   if (r.by === 'ID') {
//     let slot = await Slot.findOne({ name: r.name}).exec();
//     if (!slot || !slot.id) {
//       throw new AssertionError({ message: `Slot not found with name: ${r.name}` });
//     }
//     return slot.id;
//   }
//   return r.name;
// }

// async function getDeviceId(r: { device: string }) {
//   let device = await Device.findOne({ name: r.device }).exec();
//   if (!device || !device.id) {
//     throw new AssertionError({ message: `Device not found with name: ${r.device}`});
//   }
//   return device.id;
// }


describe('Test API v2 routes', () => {

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

  describe('Get slots (with filter) using GET', () => {
    const table = [{
      path: '/api/v2/slots', status: 200,
    }];

    for (const row of table) {
      it(`Get ${row.path}`, async () => {
        return supertest(handler)
          .get(row.path)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/slots.json'))
          .expect(expectPackage())
          .expect(row.status);
      });
    }
  });

  describe('Get devices (with filter) using GET', () => {
    const table = [{
      path: '/api/v2/devices', status: 200,
    }];

    for (const row of table) {
      it(`Get ${row.path}`, async () => {
        return supertest(handler)
          .get(row.path)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/devices.json'))
          .expect(expectPackage())
          .expect(row.status);
      });
    }
  });
});

/**
 * Tests for slots routes.
 */

/* tslint:disable:max-line-length */

import * as util from 'util';

import { assert } from 'chai';
import * as express from 'express';
import * as supertest from 'supertest';

import {
  checkPackage,
} from './shared/testing';

import {
  checkValid,
} from './shared/jsonschema';

import * as app from './app';
import * as data from './data';

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

  describe('Get slots with filter and/or paging', () => {
    const table = [{
      filter: {},
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { start: 2 },
      data: [ 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { limit: 3 },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003' ],
      status: 200,
    }, {
      filter: { START: 1, LIMIT: 2},
      data: [ 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003' ],
      status: 200,
    }, {
      filter: { name: 'FE_TEST:DEVA_D0001' },
      data: [ 'FE_TEST:DEVA_D0001' ],
      status: 200,
    }, {
      filter: { NaMe: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0004'] },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0004' ],
      status: 200,
    }, {
      filter: { DeviceType: 'DEVA' },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004' ],
      status: 200,
    }, {
      filter: { devicetype: 'DEV*' },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { machineMode: 'M01a' },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { machineMode: 'M01*'},
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { MACHINEMODE: ['M01*', 'm02' ]},
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { CareLEVEL: 'medium'},
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { carelevel: [ 'high', 'medium' ] },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { SafetyLEVEL: 'none' },
      data: [ 'FE_TEST:DEVA_D0001', 'FE_TEST:DEVA_D0003', 'FE_TEST:DEVA_D0004' ],
      status: 200,
    }, {
      filter: { safetylevel: 'CONTROL_ESH' },
      data: [ 'FE_TEST:DEVA_D0002', 'FE_TEST:DEVB_D0002' ],
      status: 200,
    }, {
      filter: { namme: 'FE_TEST:DEVA_D0001' },
      data: [],
      status: 400,
    }];

    const checkPackageMemberNames = (names: string[]) => {
      return checkPackage((d) => {
        if (!Array.isArray(d)) {
          assert.isArray(d);
          return;
        }
        assert.sameOrderedMembers(d.map((v: any) => (v.name)), names);
      });
    };

    for (const row of table) {
      const uri = '/api/v2/slots';

      it(`GET '${uri}' with query: ${util.inspect(row.filter)}`, async () => {
        return supertest(handler)
          .get(uri)
          .query(row.filter)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/slots.json'))
          .expect(checkPackageMemberNames(row.data))
          .expect(row.status);
      });

      it(`POST '${uri};filter' with body: ${util.inspect(row.filter)}`, async () => {
        return supertest(handler)
          .post(`${uri};filter`)
          .send(row.filter)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/slots.json'))
          .expect(checkPackageMemberNames(row.data))
          .expect(row.status);
      });
    }
  });

  describe('Get slot by name', () => {
    const table = [
      { name: 'FE_TEST:DEVB_D0002', status: 200 },
      { name: 'FE_TEST:DEVA_D0004', status: 200 },
      { name: 'FE_MISS:IING_D0001', status: 404 },
    ];

    for (const row of table) {
      const uri = '/api/v2/slots';

      it(`Get '${uri}/${row.name}'`, async () => {
        return supertest(handler)
          .get(`${uri}/${row.name}`)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/slot.json'))
          .expect(row.status);
      });
    }
  });

  describe('Get devices with filter and/or paging', () => {
    const table = [{
      filter: {},
      data: [ 'T99999-DEVA-0009-0099-S00001', 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { start: 1 },
      data: [ 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { limit: 1 },
      data: [ 'T99999-DEVA-0009-0099-S00001' ],
      status: 200,
    }, {
      filter: { START: 1, LIMIT: 1},
      data: [ 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { NAME: 'T99999-DEVA-0009-0099-S00001' },
      data: [ 'T99999-DEVA-0009-0099-S00001' ],
      status: 200,
    }, {
      filter: { Name: 't99999-dev*-0009-0099-*' },
      data: [ 'T99999-DEVA-0009-0099-S00001', 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { name: [ 'T99999-DEVA-0009-0099-S0000*', 'T99999-DEVB-0009-0099-S0000*'] },
      data: [ 'T99999-DEVA-0009-0099-S00001', 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { DEVICETYPE: 'dev*' },
      data: [ 'T99999-DEVA-0009-0099-S00001', 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }, {
      filter: { DEVICETYPE: 'deva' },
      data: [ 'T99999-DEVA-0009-0099-S00001' ],
      status: 200,
    }, {
      filter: { DeviceType: [ 'deva', 'devb' ]},
      data: [ 'T99999-DEVA-0009-0099-S00001', 'T99999-DEVB-0009-0099-S00002' ],
      status: 200,
    }];

    const checkPackageMemberNames = (names: string[]) => {
      return checkPackage((d) => {
        if (!Array.isArray(d)) {
          assert.isArray(d);
          return;
        }
        assert.sameOrderedMembers(d.map((v: any) => (v.name)), names);
      });
    };

    for (const row of table) {
      const uri = '/api/v2/devices';

      it(`GET '${uri}' with query: ${util.inspect(row.filter)}` , async () => {
        return supertest(handler)
          .get(uri)
          .query(row.filter)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/devices.json'))
          .expect(checkPackageMemberNames(row.data))
          .expect(row.status);
      });

      it(`POST '${uri};filter' with body: ${util.inspect(row.filter)}` , async () => {
        return supertest(handler)
          .post(`${uri};filter`)
          .send(row.filter)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/devices.json'))
          .expect(checkPackageMemberNames(row.data))
          .expect(row.status);
      });
    }
  });

  describe('Get device by name', () => {
    const table = [
      { name: 'T99999-DEVA-0009-0099-S00001', status: 200 },
      { name: 'T99999-DEVB-0009-0099-S00002', status: 200 },
      { name: 'T99999-MISS-0009-0099-S99999', status: 404 },
    ];

    for (const row of table) {
      const uri = '/api/v2/devices';

      it(`Get '${uri}/${row.name}'`, async () => {
        return supertest(handler)
          .get(`${uri}/${row.name}`)
          .set('Accept', 'application/json')
          .expect(checkValid('/api/v2/device.json'))
          .expect(row.status);
      });
    }
  });
});

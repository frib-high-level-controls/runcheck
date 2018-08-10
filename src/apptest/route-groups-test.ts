/**
 * Tests for groups routes.
 */

/* tslint:disable:max-line-length */

import { AssertionError } from 'assert';

import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

import { Group } from '../app/models/group';
import { Slot } from '../app/models/slot';

import * as app from './app';
import * as data from './data';

import {
  expectPackage,
  requestFor,
} from './shared/testing';


async function getGroupId(r: { group: string }) {
  let group = await Group.findOne({ name: r.group }).exec();
  if (!group || !group.id) {
    throw new AssertionError({ message: `Group not found with name: ${r.group}` });
  }
  return group.id;
}

async function getSlotId(r: { name: string }) {
  let slot = await Slot.findOne({ name: r.name }).exec();
  if (!slot || !slot.id) {
    throw new AssertionError({ message: `Slot not found with name: ${r.name}` });
  }
  return slot.id;
}


describe('Test group routes', () => {
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

  describe('Add slot to existing group', () => {
    let table = [
      // User unauthorized
      { name: 'FE_TEST:DEVA_D0001', user: '',     status: 302, group: 'FE_TEST:GROUP_1' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', status: 403, group: 'FE_TEST:GROUP_1' },
      // Assign OK
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_1' },
      // Slot already in group
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 400, group: 'FE_TEST:GROUP_1' },
      // Bad Request (safety level unmatch)
      { name: 'FE_TEST:DEVA_D0002', user: 'FEAM', status: 400, group: 'FE_TEST:GROUP_1' },
      // Bad Request (owner, slot area unmatch)
      { name: 'FE_TEST:DEVA_D0003', user: 'FEDM', status: 400, group: 'FE_TEST:GROUP_1' },
      // Conflict - slot in another group
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 409, group: 'FE_TEST:GROUP_2' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' add slot ${row.name} to ${row.group}`, async () => {
      const groupId = await getGroupId(row);
      const slotId = await getSlotId(row);

      let nMembers = -1;
      await request(handler)
        .get(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .expect(expectPackage())
        .expect(200)
        .expect((res: request.Response) => {
          assert.isArray(res.body.data);
          nMembers = res.body.data.length;
        });

      const agent = await requestFor(handler, row.user);
      await agent
        .post(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: { id: slotId } } )
        .expect(expectPackage(/* TODO: { groupId: groupId } */))
        .expect(row.status);

      if (row.status < 300) {
        nMembers += 1;
      }

      await request(handler)
        .get(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .expect(expectPackage())
        .expect(200)
        .expect((res: request.Response) => {
          assert.isArray(res.body.data);
          assert.strictEqual(res.body.data.length, nMembers);
        });
      });
    }
  });


  describe('Get Device History', () => {
    const table = [
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_1' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_2' },
    ];

    for (const row of table) {
      it( `User ${row.user || 'anonymous'} get group history (${row.name})`, async () => {
        const groupId = await getGroupId(row);
        const agent = await requestFor(handler, row.user);
        return agent
          .get(`/groups/slot/${groupId}/history`)
          .set('Accept', 'application/json')
          .expect(200)
          .expect(expectPackage());
      });
    }
  });

  describe('Remove slot from a group', () => {
    let table = [
      // User unauthorized
      { name: 'FE_TEST:DEVA_D0001', user: '',     status: 302, group: 'FE_TEST:GROUP_1' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', status: 403, group: 'FE_TEST:GROUP_1' },
      // Remove OK
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_1' },
      // Slot not in group
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 400, group: 'FE_TEST:GROUP_1' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' remove slot ${row.name} from ${row.group}`, async () => {
      const groupId = await getGroupId(row);
      const slotId = await getSlotId(row);

      let nMembers = -1;
      await request(handler)
        .get(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .expect(expectPackage())
        .expect(200)
        .expect((res: request.Response) => {
          assert.isArray(res.body.data);
          nMembers = res.body.data.length;
        });

      const agent = await requestFor(handler, row.user);
      await agent
        .delete(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: { id: slotId } } )
        .expect(expectPackage())
        .expect(row.status);

      if (row.status < 300) {
        nMembers -= 1;
      }

      await request(handler)
        .get(`/groups/slot/${groupId}/members`)
        .set('Accept', 'application/json')
        .expect(expectPackage())
        .expect(200)
        .expect((res: request.Response) => {
          assert.isArray(res.body.data);
          assert.strictEqual(res.body.data.length, nMembers);
        });
      });
    }
  });

  describe('Add new slot group', () => {
    // TODO: the type definition here seems to be required for TypeScript v2.5.3, remove later if possible!
    let table: Array<{ user: string; status: number; data: { name?: string; desc?: string; owner?: string; safetyLevel?: string; }}> = [
      // User unauthorized
      { user: '',     status: 302, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
      { user: 'FEDM', status: 403, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
      // Slot Group name, owner and safety level are required
      { user: 'FEAM', status: 400, data: {}},
      // Slot Group name is required
      { user: 'FEAM', status: 400, data: {                          desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
      { user: 'FEAM', status: 400, data: { name: '',                desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
      // Slot Group owner is required
      { user: 'FEAM', status: 400, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3',            safetyLevel: 'NONE' }},
      { user: 'FEAM', status: 400, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: '', safetyLevel: 'NONE' }},
      // Slot Group safety level is required
      { user: 'FEAM', status: 400, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END'                        }},
      { user: 'FEAM', status: 400, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: ''       }},
      { user: 'FEAM', status: 400, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'INVALD' }},
      // Assign OK
      { user: 'FEAM', status: 200, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
      // Add again - Duplicate groups allowed
      { user: 'FEAM', status: 200, data: { name: 'FE_TEST:GROUP_3', desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NONE' }},
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' add new slot group ${row.data.name}`, async () => {
      const agent = await requestFor(handler, row.user);
      await agent
        .post(`/groups/slot`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: row.data } )
        .expect(expectPackage(row.data))
        .expect(row.status);
      });
    }
  });
});

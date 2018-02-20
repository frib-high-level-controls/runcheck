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
      { name: 'FE_TEST:DEVA_D0001', user: '', status: 302, group: 'FE_TEST:GROUP_1' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', status: 403, group: 'FE_TEST:GROUP_1' },
      // Assign OK
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_1' },
      // Bad Request (safety level unmatch)
      { name: 'FE_TEST:DEVA_D0002', user: 'FEAM', status: 400, group: 'FE_TEST:GROUP_1' },
      // Bad Request (owner, slot area unmatch)
      { name: 'FE_TEST:DEVA_D0003', user: 'FEDM', status: 400, group: 'FE_TEST:GROUP_1' },
      // Conflict - slot in another group
      { name: 'FE_TEST:DEVA_D0004', user: 'FEAM', status: 409, group: 'FE_TEST:GROUP_1' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' add slot ${row.name} to ${row.group}`, async () => {
      const groupid = await getGroupId(row);
      const slotId = await getSlotId(row);
      const agent = await requestFor(handler, row.user);
      await agent
        .post(`/groups/slot/${groupid}/members`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: { id: slotId } } )
        .expect(row.status)
        .expect(expectPackage());
      });
    }
  });

  describe('Remove slot from a group', () => {
    let table = [
      // User unauthorized
      { name: 'FE_TEST:DEVA_D0001', user: '', status: 302, group: 'FE_TEST:GROUP_1' },
      { name: 'FE_TEST:DEVA_D0001', user: 'FEDM', status: 403, group: 'FE_TEST:GROUP_1' },
      // Remove OK
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 200, group: 'FE_TEST:GROUP_1' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' remove slot ${row.name} from ${row.group}`, async () => {
      const groupid = await getGroupId(row);
      const slotId = await getSlotId(row);
      const agent = await requestFor(handler, row.user);
      await agent
        .delete(`/groups/slot/${groupid}/members`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: { id: slotId } } )
        .expect(row.status)
        .expect(expectPackage());
      });
    }
  });

  describe('Add new slot group', () => {
    let table = [
      // User unauthorized
      { name: 'FE_TEST:GROUP_3', user: '', status: 302, desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NORMAL' },
      // Assign OK
      { name: 'FE_TEST:GROUP_3', user: 'FEAM', status: 200, desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NORMAL' },
      // Add again - Duplicate groups allowed
      { name: 'FE_TEST:GROUP_3', user: 'FEAM', status: 200, desc: 'Test Group #3', owner: 'ADB:FRONT_END', safetyLevel: 'NORMAL' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' add new slot group ${row.name}`, async () => {
      const agent = await requestFor(handler, row.user);
      await agent
        .post(`/groups/slot`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ data: { name: row.name, owner: row.owner, description: row.desc, safetyLevel: row.safetyLevel } } )
        .expect(row.status)
        .expect(expectPackage());
      });
    }
  });
});

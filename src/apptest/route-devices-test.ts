/**
 * Tests for devices routes.
 */
import { assert } from 'chai';
import * as dbg from 'debug';
import * as express from 'express';
import * as request from 'supertest';

import {
  Device,
} from '../app/models/device';

import * as app from './app';
import * as data from './data';

const debug = dbg('runcheck:test:devices');

// Utility to get an authenticated agent for the specified user.
async function requestFor(app: express.Application, username: string, password?: string) {
  const agent = request.agent(app);
  await agent
    .get('/login')
    .auth(username, password || 'Pa5w0rd')
    .expect(302);
  return agent;
};

describe('Device T99999-TEST-0009-0099-S00002', () => {

  let deviceId: string;

  let handler: express.Application;

  before(async () => {
    // Start the application
    handler = await app.start();
    // Initialize the test data
    await data.initialize();
  });

  before(async () => {
    // Given the device name, get the document UID
    const device = await Device.findOne({
      name: 'T99999-TEST-0009-0099-S00002',
    });
    if (!device || !device.id) {
      throw new Error('Device not found');
    }
    deviceId = device.id;
    debug('Device T99999-TEST-0009-0099-S00002 => %s', deviceId);
  });

  after(async () => {
    await app.stop();
  });

  it('Anonymous user get device by name', () => {
    return request(handler)
      .get(`/devices/T99999-TEST-0009-0099-S00002`)
      .set('Accept', 'application/json')
      .expect(200);
  });

  it('User "feam" assign checklist', async () => {
    const agent = await requestFor(handler, 'feam');
    return agent
      .put(`/devices/${deviceId}/checklistId`)
      .set('Accept', 'application/json')
      .expect(403);
  });

  it('User "fedm" assign checklist', async () => {
    const agent = await requestFor(handler, 'fedm');
    return agent
      .put(`/devices/${deviceId}/checklistId`)
      .set('Accept', 'application/json')
      .expect(201);
  });
});

/**
 * Tests for slots routes.
 */
import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

import * as app from './app';
import * as data from './data';

// Utility to get an authenticated agent for the specified user.
async function requestFor(app: express.Application, username: string, password?: string) {
  const agent = request.agent(app);
  await agent
    .get('/login')
    .auth(username, password || 'Pa5w0rd')
    .expect(302);
  return agent;
};

describe('Slot FE_TEST:DEV_D0001', () => {

  let slotName = 'FE_TEST:DEV_D0001';

  let slotId: string | undefined;
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

  it('Anonymous user get device by name and ID', async () => {
    await request(handler)
      .get(`/slots/${slotName}`)
      .set('Accept', 'application/json')
      .expect(200)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isUndefined(pkg.error);
        assert.isDefined(pkg.data);
        assert.isDefined(pkg.data.id);
        assert.deepEqual(pkg.data.name, slotName);
        slotId = pkg.data.id;
      });

    await request(handler)
      .get(`/slots/${slotId}`)
      .set('Accept', 'application/json')
      .expect(200)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isUndefined(pkg.error);
        assert.isDefined(pkg.data);
        assert.isDefined(pkg.data.id);
        assert.deepEqual(pkg.data.name, slotName);
        assert.deepEqual(pkg.data.id, slotId);
      });
  });

  it('Anonymous user assign checklist by name and ID', async () => {
    await request(handler)
      .put(`/slots/${slotName}/checklistId`)
      .set('Accept', 'application/json')
      .expect(302).expect('Location', /^\/login($|\?)/);

    await request(handler)
      .put(`/slots/${slotId}/checklistId`)
      .set('Accept', 'application/json')
      .expect(302).expect('Location', /^\/login($|\?)/);
  });

  it('User "FEDM" assign checklist by name and ID', async () => {
    const agent = await requestFor(handler, 'fedm');
    await agent
      .put(`/slots/${slotName}/checklistId`)
      .set('Accept', 'application/json')
      .expect(403)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isObject(pkg.error);
        assert.isString(pkg.error.message);
      });

    await agent
      .put(`/slots/${slotId}/checklistId`)
      .set('Accept', 'application/json')
      .expect(403)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isObject(pkg.error);
        assert.isString(pkg.error.message);
      });
  });

  it('User "FEAM" assign checklist by name and ID', async () => {
    let checklistId: string | undefined;
    const agent = await requestFor(handler, 'feam');
    await agent
      .put(`/slots/${slotName}/checklistId`)
      .set('Accept', 'application/json')
      .expect(201)
      .expect((res: request.Response) => {
        let pkg = <webapi.Pkg<string>> res.body;
        assert.isObject(pkg);
        assert.isUndefined(pkg.error);
        assert.isString(pkg.data);
        checklistId = pkg.data;
      });

    await agent
      .put(`/slots/${slotId}/checklistId`)
      .set('Accept', 'application/json')
      .expect(200)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isUndefined(pkg.error);
        assert.deepEqual(pkg.data, checklistId);
      });

    await agent
      .get(`/checklists/${checklistId}`)
      .set('Accept', 'application/json')
      .expect(200)
      .expect((res: request.Response) => {
        let pkg = res.body;
        assert.isObject(pkg);
        assert.isUndefined(pkg.error);
        assert.deepEqual(pkg.data.id, checklistId);
        assert.deepEqual(pkg.data.type, 'slot-default');
      });
  });
});

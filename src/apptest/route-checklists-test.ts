/**
 * Tests for devices routes.
 */

/* tslint:disable:max-line-length */

import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

import * as app from './app';
import * as data from './data';

import {
  expectPackage,
  requestFor,
} from './shared/testing';



describe('Test Checklist routes', () => {

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

  describe('Assign checklist before device installation', () => {
    let table = [
      // User unauthenticated
      { target: '/slots/FE_TEST:DEVA_D0001', targetType: 'SLOT', user: '', status: 302 },
      { target: '/slots/FE_TEST:DEVB_D0002', targetType: 'SLOT', user: '', status: 302 },
      // User unauthorized
      { target: '/slots/FE_TEST:DEVA_D0001', targetType: 'SLOT', user: 'FEDM', status: 403 },
      { target: '/slots/FE_TEST:DEVB_D0002', targetType: 'SLOT', user: 'FEDM', status: 403 },
      // Assign OK
      { target: '/slots/FE_TEST:DEVA_D0001', targetType: 'SLOT', user: 'FEAM', status: 400 },
      { target: '/slots/FE_TEST:DEVB_D0002', targetType: 'SLOT', user: 'FEAM', status: 400 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} assign checklist to ${row.target}`, async () => {
        let targetId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.id);
            targetId = String(res.body.data.id);
          });
        const agent = await requestFor(handler, row.user);
        await agent
          .post(`/checklists`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: { targetId: targetId, targetType: row.targetType }})
          .expect(row.status)
          .expect(expectPackage());
      });
    }
  });

  describe('Install Device into Slots', () => {
    let table = [
      // Installation OK
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 200 },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 200 },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}', install device (${row.device} => ${row.name})`, async () => {
        let deviceId: string | undefined;
        await request(handler)
          .get(`/devices/${row.device}`)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.id);
            deviceId = String(res.body.data.id);
          });
        const agent = await requestFor(handler, row.user);
        return agent
          .put(`/slots/${row.name}/installation`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: { installDeviceId: deviceId, installDeviceOn: row.date } })
          .expect(expectPackage({ installDeviceOn: row.date }))
          .expect(row.status);
      });
    }
  });

  describe('Assign checklist', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', user: '', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 302 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', user: '', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   user: '', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 302 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   user: '', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          targetType: 'GROUP',  user: '', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', user: 'FEAM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 403 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', user: 'FEAM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   user: 'FEDM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 403 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   user: 'FEDM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          targetType: 'GROUP',  user: 'FEDM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 403 },
      // Assign OK
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', user: 'FEDM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 3 }, status: 201 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', user: 'FEDM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 3 }, status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 4 }, status: 201 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   user: 'FEAM', cl: { checklistType: 'SLOT_SAFETY',    approved: false, checked: 0, total: 5 }, status: 201 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          targetType: 'GROUP',  user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 4 }, status: 201 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          targetType: 'GROUP',  user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 4 }, status: 201 },
      // Already assigned
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', user: 'FEDM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 409 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', user: 'FEDM', cl: { checklistType: 'DEVICE_DEFAULT', approved: false, checked: 0, total: 0 }, status: 409 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 409 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 409 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          targetType: 'GROUP',  user: 'FEAM', cl: { checklistType: 'SLOT_DEFAULT',   approved: false, checked: 0, total: 0 }, status: 409 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} assign checklist to ${row.target}`, async () => {
        let targetId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.id);
            targetId = String(res.body.data.id);
          });
        const agent = await requestFor(handler, row.user);
        await agent
          .post(`/checklists`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: { targetId: targetId, targetType: row.targetType }})
          .expect(expectPackage(row.cl))
          .expect(row.status);
      });
    }
  });

  let customChecklistSubjects: Array<{target: string, name: string, desc: string}> = [];

  describe('Create custom checklist subject', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', data: {}, cl: {}, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: '', data: {}, cl: {}, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: '', data: {}, cl: {}, status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 403 },
      // Invalid data
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: '' },                               cl: {}, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'SUB1' },                           cl: {}, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: [] },                          cl: {}, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: 'NOT_AN_ARRAY' },              cl: {}, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: [ 'NOT_A_ROLE' ] },            cl: {}, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: '' },                               cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'SUB1' },                           cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: [] },                          cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: 'NOT_AN_ARRAY' },              cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: [ 'NOT_A_ROLE' ] },            cl: {}, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { desc: '' },                               cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { desc: 'SUB1' },                           cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { assignees: [] },                          cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { assignees: 'NOT_AN_ARRAY' },              cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { assignees: [ 'NOT_A_ROLE' ] },            cl: {}, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, cl: {}, status: 400 },
      // Subject created
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'EE2', assignees: [ 'USR:EESME' ] },  cl: { approved: false, checked: 0, total: 4 }, status: 201 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, cl: { approved: false, checked: 0, total: 5 }, status: 201 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM', data: { desc: 'ME2', assignees: [ 'USR:MESME' ] },  cl: { approved: false, checked: 0, total: 4 }, status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'EE2', assignees: [ 'USR:EESME' ] },  cl: { approved: false, checked: 0, total: 5 }, status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, cl: { approved: false, checked: 0, total: 6 }, status: 201 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM', data: { desc: 'ME2', assignees: [ 'USR:MESME' ] },  cl: { approved: false, checked: 0, total: 6 }, status: 201 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, cl: { approved: false, checked: 0, total: 5 }, status: 201 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} create checklist (${row.target}) subject, data: ${JSON.stringify(row.data)}`, async () => {
        let checklistId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.checklistId);
            checklistId = String(res.body.data.checklistId);
          });

        const agent = await requestFor(handler, row.user);
        await agent
          .post(`/checklists/${checklistId}/subjects`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: row.data })
          .expect(expectPackage(row.data))
          .expect(row.status)
          .expect((res: request.Response) => {
            // Save the name of custom subjects for use in other tests!
            if (res.status < 300) {
              assert.isString(res.body.data.name);
              assert.isString(res.body.data.desc);
              customChecklistSubjects.push({
                target: row.target,
                name: String(res.body.data.name),
                desc: String(res.body.data.desc),
              });
            }
          });

        await request(handler)
          .get(`/checklists/${checklistId}`)
          .set('Accept', 'application/json')
          .expect(expectPackage(row.cl))
          .expect(200);
      });
    }
  });

  describe('Modify checklist subject', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', subject: 'EE', data: {}, cl: { approved: false, checked: 0, total: 5 }, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: '', subject: 'EE', data: {}, cl: { approved: false, checked: 0, total: 6 }, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: '', subject: 'EE', data: {}, cl: { approved: false, checked: 0, total: 5 }, status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM', subject: 'EE', data: { required: false }, cl: { approved: false, checked: 0, total: 5 }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM', subject: 'EE', data: { required: false }, cl: { approved: false, checked: 0, total: 6 }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM', subject: 'EE', data: { required: false }, cl: { approved: false, checked: 0, total: 5 }, status: 403 },
      // Invalid data
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { required: 0 },               cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { required: 1 },               cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { required: 'false' },         cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'DO',  data: { required: false },           cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'DO',  data: { assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'ALT', data: { required: false },           cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { assignees: 'NOT_AN_ARRAY' }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { assignees: 'USR:ALTSME' },   cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE',  data: { assignees: ['NOT_A_ROLE'] }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { required: 0 },               cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { required: 1 },               cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { required: 'false' },         cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'AM',  data: { required: false },           cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'AM',  data: { assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'ALT', data: { required: false },           cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { assignees: 'NOT_AN_ARRAY' }, cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { assignees: 'USR:ALTSME' },   cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE',  data: { assignees: ['NOT_A_ROLE'] }, cl: { approved: false, checked: 0, total: 6 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { required: 0 },               cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { required: 1 },               cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { required: 'false' },         cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'AM',  data: { required: false },           cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'AM',  data: { assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'ALT', data: { required: false },           cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { assignees: 'NOT_AN_ARRAY' }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { assignees: 'USR:ALTSME' },   cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE',  data: { assignees: ['NOT_A_ROLE'] }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      // Subject modified
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'EE', data: { required: false },                           cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subject: 'ME', data: { required: true, assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM', subject: 'EE', data: { required: false },                           cl: { approved: false, checked: 0, total: 3 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM', subject: 'EE', data: { required: true },                            cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'EE', data: { required: false },                           cl: { approved: false, checked: 0, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', subject: 'ME', data: { required: true, assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM', subject: 'EE', data: { required: false },                           cl: { approved: false, checked: 0, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM', subject: 'EE', data: { required: true },                            cl: { approved: false, checked: 0, total: 6 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'EE', data: { required: false },                           cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'ME', data: { required: true, assignees: ['USR:ALTSME'] }, cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM', subject: 'DO', data: { required: true, assignees: ['USR:FEDM'] },   cl: { approved: false, checked: 0, total: 4 }, status: 200 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} modify checklist (${row.target}) subject: ${row.subject}, data: ${JSON.stringify(row.data)}`, async () => {
        let checklistId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.checklistId);
            checklistId = String(res.body.data.checklistId);
          });
        for (let c of customChecklistSubjects) {
          if (c.target === row.target && c.desc === row.subject) {
            row.subject = c.name;
            break;
          }
        }

        const agent = await requestFor(handler, row.user);
        await agent
          .put(`/checklists/${checklistId}/subjects/${row.subject}`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: row.data })
          .expect(expectPackage(row.data))
          .expect(row.status);

        await request(handler)
          .get(`/checklists/${checklistId}`)
          .set('Accept', 'application/json')
          .expect(expectPackage(row.cl))
          .expect(200);
      });
    }
  });

  describe('Update checklist status', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', subject: 'EE', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 302 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', subject: 'DO', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: '', subject: 'EE', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 5 }, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: '', subject: 'AM', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 5 }, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: '', subject: 'EE', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: '', subject: 'AM', data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'EESME', subject: 'ME',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM',  subject: 'EE',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM',  subject: 'DO',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM',  subject: 'EE',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 5 }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'EESME', subject: 'ME',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 5 }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM',  subject: 'EE',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'EESME', subject: 'ME',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEDM',  subject: 'DO',  data: { value: 'Y' }, cl: { approved: false, checked: 0, total: 4 }, status: 403 }, // No SME Assigneed!
      // Invalid data
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'EESME',  subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 4 }, status: 400 }, // Not required!
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 4 }, status: 400 }, // Not required!
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'ALTSME', subject: 'ME',  data: { value: 'no' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'ALTSME', subject: 'ALT', data: { value: 'YES' },     cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'DO',  data: { value: 'No' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'DO',  data: { value: 'YC' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME',  subject: 'EE',  data: { value: true },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME',  subject: 'EE',  data: { comment: 'Test!' }, cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'EESME',  subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 5 }, status: 400 }, // Not required!
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 5 }, status: 400 }, // Not required!
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'ALTSME', subject: 'ME',  data: { value: 'no' },      cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'ALTSME', subject: 'ALT', data: { value: 'YES' },     cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM',   subject: 'DO',  data: { value: 'NO' },      cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'AM',  data: { value: true },      cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM',   subject: 'DO',  data: { value: 'YC' },      cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'AM',  data: { comment: 'Test!' }, cl: { approved: false, checked: 0, total: 5 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'EESME',  subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 4 }, status: 400 }, // Not required!
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',   subject: 'EE',  data: { value: 'Y' },       cl: { approved: false, checked: 0, total: 4 }, status: 400 }, // Not required!
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'ALTSME', subject: 'ME',  data: { value: 'no' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'ALTSME', subject: 'ALT', data: { value: 'YES' },     cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM',   subject: 'DO',  data: { value: 'NO' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',   subject: 'AM',  data: { value: true },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM',   subject: 'DO',  data: { value: 'YC' },      cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',   subject: 'AM',  data: { comment: 'Test!' }, cl: { approved: false, checked: 0, total: 4 }, status: 400 },
      // Status updated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'ALT', data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'ALT', data: { value: 'N' },                         cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'ALTSME', subject: 'ALT', data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'ALTSME', subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM',   subject: 'DO',  data: { value: 'Y' },                         cl: { approved: true,  checked: 3, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME',  subject: 'EE',  data: { value: 'YC', comment: 'EE COMMENT' }, cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'MESME',  subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM',   subject: 'DO',  data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 4 }, status: 400 }, // YC required!
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM',   subject: 'DO',  data: { value: 'YC', comment: 'DO COMMENT' }, cl: { approved: true,  checked: 3, total: 4 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'DO',  data: { value: 'YC', comment: 'DO BY FEAM' }, cl: { approved: false, checked: 1, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'DO',  data: { value: 'N' },                         cl: { approved: false, checked: 0, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM',   subject: 'DO',  data: { value: 'YC', comment: 'DO COMMENT' }, cl: { approved: false, checked: 1, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'ALT', data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'ALT', data: { value: 'N' },                         cl: { approved: false, checked: 1, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'ALTSME', subject: 'ALT', data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'ALTSME', subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 3, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'AM',  data: { value: 'Y' },                         cl: { approved: false, checked: 3, total: 5 }, status: 400 }, // YC required!
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM',   subject: 'AM',  data: { value: 'YC', comment: 'AM COMMENT' }, cl: { approved: true,  checked: 4, total: 5 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'MESME',  subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'MESME',  subject: 'ME',  data: { value: 'N' },                         cl: { approved: false, checked: 0, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'MESME',  subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'EESME',  subject: 'EE',  data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'LSM',    subject: 'SM',  data: { value: 'Y' },                         cl: { approved: false, checked: 3, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM',   subject: 'AM',  data: { value: 'Y' },                         cl: { approved: true,  checked: 4, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'LSM',    subject: 'SM',  data: { value: 'N' },                         cl: { approved: false, checked: 3, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'LSM',    subject: 'SM',  data: { value: 'Y' },                         cl: { approved: true,  checked: 4, total: 6 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',  subject: 'DO',  data: { value: 'YC', comment: 'DO BY FEAM' },   cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',  subject: 'DO',  data: { value: 'N' },                          cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEDM',   subject: 'DO',  data: { value: 'YC', comment: 'DO COMMENT' }, cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',  subject: 'ALT', data: { value: 'Y' },                          cl: { approved: false, checked: 2, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',  subject: 'ALT', data: { value: 'N' },                          cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'ALTSME', subject: 'ALT', data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'ALTSME', subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 3, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',   subject: 'AM',  data: { value: 'Y' },                         cl: { approved: false, checked: 3, total: 4 }, status: 400 }, // YC required!
      { target: '/groups/slot/FE_SLOT_GROUP01',          user: 'FEAM',   subject: 'AM',  data: { value: 'YC', comment: 'AM COMMENT' }, cl: { approved: true,  checked: 4, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEAM',   subject: 'DO',  data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 4 }, status: 200 }, // No SME Assigneed!
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEAM',   subject: 'DO',  data: { value: 'N' },                         cl: { approved: false, checked: 0, total: 4 }, status: 200 }, // No SME Assigneed!
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'MESME',  subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'MESME',  subject: 'ME',  data: { value: 'N' },                         cl: { approved: false, checked: 0, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'MESME',  subject: 'ME',  data: { value: 'Y' },                         cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'EESME',  subject: 'EE',  data: { value: 'Y' },                         cl: { approved: false, checked: 2, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEAM',   subject: 'AM',  data: { value: 'Y' },                         cl: { approved: true,  checked: 3, total: 4 }, status: 200 },
      // Basic subjects are locked after primary approved
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME', subject: 'EE', data: { value: 'N' },                          cl: { approved: true,  checked: 3, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME', subject: 'EE', data: { value: 'Y' },                          cl: { approved: true,  checked: 3, total: 4 }, status: 400 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM',  subject: 'DO', data: { value: 'N' },                          cl: { approved: false, checked: 2, total: 4 }, status: 200 }, // Unlock
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME', subject: 'EE', data: { value: 'N' },                          cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM',  subject: 'DO', data: { value: 'YC', comment: 'DO COMMENT2' }, cl: { approved: true,  checked: 2, total: 4 }, status: 200 }, // Lock
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'EESME', subject: 'EE', data: { value: 'Y' },                          cl: { approved: true,  checked: 2, total: 4 }, status: 400 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'EESME', subject: 'EE', data: { value: 'N' },                          cl: { approved: true,  checked: 4, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'EESME', subject: 'EE', data: { value: 'Y' },                          cl: { approved: true,  checked: 4, total: 6 }, status: 400 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM',  subject: 'AM', data: { value: 'N' },                          cl: { approved: false, checked: 3, total: 6 }, status: 200 }, // Unlock
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'EESME', subject: 'EE', data: { value: 'N' },                          cl: { approved: false, checked: 2, total: 6 }, status: 200 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM',  subject: 'AM', data: { value: 'Y' },                          cl: { approved: true,  checked: 3, total: 6 }, status: 200 }, // Lock
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'EESME', subject: 'EE', data: { value: 'Y' },                          cl: { approved: true,  checked: 3, total: 6 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'MESME', subject: 'ME', data: { value: 'N' },                          cl: { approved: true,  checked: 3, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'MESME', subject: 'ME', data: { value: 'Y' },                          cl: { approved: true,  checked: 3, total: 4 }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEAM',  subject: 'AM', data: { value: 'N' },                          cl: { approved: false, checked: 2, total: 4 }, status: 200 }, // Unlock
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'EESME', subject: 'EE', data: { value: 'N' },                          cl: { approved: false, checked: 1, total: 4 }, status: 200 },
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'FEAM',  subject: 'AM', data: { value: 'Y' },                          cl: { approved: true,  checked: 2, total: 4 }, status: 200 }, // Lock
      { target: '/groups/slot/FE_SLOT_GROUP02',          user: 'EESME', subject: 'EE', data: { value: 'Y' },                          cl: { approved: true,  checked: 2, total: 4 }, status: 400 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} update checklist (${row.target}) subject: ${row.subject}, data: ${JSON.stringify(row.data)}`, async () => {
        let checklistId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            assert.isObject(res.body, 'res.body');
            assert.isObject(res.body.data, 'res.body.data');
            assert.isString(res.body.data.checklistId, 'res.body.data.checklistId');
            checklistId = String(res.body.data.checklistId);
          });

        for (let c of customChecklistSubjects) {
          if (c.target === row.target && c.desc === row.subject) {
            row.subject = c.name;
            break;
          }
        }

        const agent = await requestFor(handler, row.user);
        await agent
          .put(`/checklists/${checklistId}/statuses/${row.subject}`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: row.data })
          .expect(expectPackage(row.data))
          .expect(row.status);

        await request(handler)
          .get(`/checklists/${checklistId}`)
          .set('Accept', 'application/json')
          .expect(expectPackage(row.cl))
          .expect(200);
      });
    }
  });

});

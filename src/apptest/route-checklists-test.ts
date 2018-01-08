/**
 * Tests for devices routes.
 */

/* tslint:disable:max-line-length */

//import { AssertionError } from 'assert';

import { assert } from 'chai';
import * as express from 'express';
import * as request from 'supertest';

// import {
//   Checklist,
// } from '../app/models/checklist';

//import { Device } from '../app/models/device';

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

// Get the checklist ID given the target path
// async function getChecklistId(app: express.Application, target: string): Promise<string> {
//   let checklistId: string | undefined;
//   await request(app)
//     .get(target)
//     .set('Accept', 'application/json')
//     .expect(200)
//     .expect((res: request.Response) => {
//       assert.isString(res.body.checklistId);
//       checklistId = res.body.checklistId;
//     });
//   if (!checklistId) {
//     throw new AssertionError({ message: `ChecklistId not found for target: ${target}` });
//   }
//   return checklistId;
// };



// TODO: Make this into a utility
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
        console.error((<any> pkg.error).message);
      }
    }
  };
};

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
          .expect(row.status)
          .expect(expectPackage({ installDeviceOn: row.date }));
      });
    }
  });

  describe('Assign checklist', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', checklistType: 'device-default', user: '', status: 302 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', checklistType: 'device-default', user: '', status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   checklistType: 'slot-default',   user: '', status: 302 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   checklistType: 'slot-default',   user: '', status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           targetType: 'GROUP',  checklistType: 'slot-default',   user: '', status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEAM', status: 403 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEAM', status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEDM', status: 403 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEDM', status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           targetType: 'GROUP',  checklistType: 'slot-default',   user: 'FEDM', status: 403 },
      // Assign OK
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEDM', status: 201 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEDM', status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEAM', status: 201 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEAM', status: 201 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           targetType: 'GROUP',  checklistType: 'slot-default',   user: 'FEAM', status: 201 },
      // Already assigned
      { target: '/devices/T99999-DEVA-0009-0099-S00001', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEDM', status: 409 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', targetType: 'DEVICE', checklistType: 'device-default', user: 'FEDM', status: 409 },
      { target: '/slots/FE_TEST:DEVA_D0001',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEAM', status: 409 },
      { target: '/slots/FE_TEST:DEVB_D0002',             targetType: 'SLOT',   checklistType: 'slot-default',   user: 'FEAM', status: 409 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           targetType: 'GROUP',  checklistType: 'slot-default',   user: 'FEAM', status: 409 },
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
          .expect(expectPackage({ checklistType: row.checklistType }));
      });
    }
  });

  let customChecklistSubjects: Array<{target: string, name: string, desc: string}> = [];

  describe('Create custom checklist subject', () => {
    let table = [
      // User unauthenticated
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', data: {}, status: 302 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: '', data: {}, status: 302 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: '', data: {}, status: 302 },
      // User unauthorized
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEDM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, status: 403 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEDM', data: { desc: 'SUB1', assignees: [ 'USR:ALTSME' ] }, status: 403 },
      // Invalid data
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: '' },                               status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'SUB1' },                           status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: [] },                          status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: 'NOT_AN_ARRAY' },              status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { assignees: [ 'NOT_A_ROLE' ] },            status: 400 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: '' },                               status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'SUB1' },                           status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: [] },                          status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: 'NOT_AN_ARRAY' },              status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { assignees: [ 'NOT_A_ROLE' ] },            status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { desc: '' },                               status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { desc: 'SUB1' },                           status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { assignees: [] },                          status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { assignees: 'NOT_AN_ARRAY' },              status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { assignees: [ 'NOT_A_ROLE' ] },            status: 400 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { desc: 111, assignees: [ 'USR:ALTSME' ] }, status: 400 },
      // Subject created
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'EE2', assignees: [ 'USR:EESME' ] },  status: 201 },
      { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, status: 201 },
      { target: '/devices/T99999-DEVB-0009-0099-S00002', user: 'FEDM', data: { desc: 'ME2', assignees: [ 'USR:MESME' ] },  status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'EE2', assignees: [ 'USR:EESME' ] },  status: 201 },
      { target: '/slots/FE_TEST:DEVA_D0001',             user: 'FEAM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, status: 201 },
      { target: '/slots/FE_TEST:DEVB_D0002',             user: 'FEAM', data: { desc: 'ME2', assignees: [ 'USR:MESME' ] },  status: 201 },
      { target: '/groups/slot/FE_SLOT_GROUP1',           user: 'FEAM', data: { desc: 'ALT', assignees: [ 'USR:ALTSME' ] }, status: 201 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} create checklist subject, data: ${JSON.stringify(row.data)}`, async () => {
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
          .expect(row.status)
          .expect(expectPackage(row.data))
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
      });
    }
  });

  describe('Modify checklist subject', () => {
    let table = [
      // User unauthenticated
      { target: '/slots/FE_TEST:DEVA_D0001', user: '', subject: 'EE', data: { }, status: 302 },
      // User unauthorized
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEDM', subject: 'EE', data: { required: false }, status: 403 },
      // Invalid data
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { required: 0 },                status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { required: 1 },                status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { required: 'false' },          status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'AM',   data: { required: false },            status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'SUB1', data: { required: false },            status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { assignees: 'NOT_AN_ARRAY' },  status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { assignees: 'USR:ALTSME' },    status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE',   data: { assignees:  ['NOT_A_ROLE'] }, status: 400 },
      // Subject modified
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE', data: { required: false },                           status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE', data: { required: true  },                           status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'EE', data: { assignees: ['USR:ALTSME'] },                 status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM', subject: 'ME', data: { required: true, assignees: ['USR:ALTSME'] }, status: 200 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} modify checklist subject: ${row.subject}, data: ${JSON.stringify(row.data)}`, async () => {
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
          .expect(row.status)
          .expect(expectPackage(row.data));
      });
    }
  });

  describe('Update checklist status', () => {
    let table = [
      // User unauthenticated
      { target: '/slots/FE_TEST:DEVA_D0001', user: '', subject: 'EE', data: { value: 'Y' }, status: 302 },
      // User unauthorized
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEDM',  subject: 'EE', data: { value: 'Y' }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'EESME', subject: 'ME', data: { value: 'Y' }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',  subject: 'EE', data: { value: 'Y' }, status: 403 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',  subject: 'DO', data: { value: 'Y' }, status: 403 },
      // Invalid data
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'ALTSME', subject: 'EE',   data: { value: 'YES' },     status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEDM',   subject: 'DO',   data: { value: 'NO' },      status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',   subject: 'AM',   data: { value: true },      status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEDM',   subject: 'DO',   data: { value: 'YC' },      status: 400 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',   subject: 'AM',   data: { comment: 'Test!' }, status: 400 },
      // Status updated
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'ALTSME', subject: 'EE', data: { value: 'N' },                       status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'ALTSME', subject: 'EE', data: { value: 'Y' },                       status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'ALTSME', subject: 'ME', data: { value: 'Y' },                       status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEDM',   subject: 'DO', data: { value: 'YC', comment: 'Test!' },    status: 200 },
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',   subject: 'AM', data: { value: 'YC', comment: 'Comment!' }, status: 200 },
      // Status of AM subject must be YC if 'basic' subjects are YC!
      { target: '/slots/FE_TEST:DEVA_D0001', user: 'FEAM',  subject: 'AM', data: { value: 'Y' }, status: 400 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} update checklist status: ${row.subject}, data: ${JSON.stringify(row.data)}`, async () => {
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
          .put(`/checklists/${checklistId}/statuses/${row.subject}`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: row.data })
          .expect(row.status)
          .expect(expectPackage(row.data));
      });
    }
  });

  // describe('Modify custom checklist subjects', () => {
  //   let table = [
  //     // User unauthenticated
  //     { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', subjects: [[ 'EE', false ]], status: 302 },
  //     // User unauthorized
  //     //{ target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM', subjects: [[ 'EE', false ]], status: 403 },
  //     // Update Successful
  //     //{ target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subjects: [[ 'EE', false ]], status: 200 },
  //     // Checklist subject mandatory
  //     //{ target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subjects: [[ 'DO', false ]], status: 400 },
  //   ];

  //   //let cache: { [key: string]: { [key: string]: string } } = {};

  //   for (let row of table) {
  //     it(`User '${row.user || 'Anonymous'}' customize checklist: ${JSON.stringify(row.subjects)}`, async () => {
  //       //let checklistId = await getChecklistId(handler, row.target);
  //       // let checklistId = 'UNKNOWN';
  //       // await request(handler)
  //       //   .get(row.target)
  //       //   .set('Accept', 'application/json')
  //       //   .expect(200)
  //       //   .expect((res: request.Response) => {
  //       //     checklistId = res.body.checklistId;
  //       //   });

  //     // await request(handler)
  //     //   .get(`/checklists/${checklistId}`)
  //     //   .set('Accept', 'application/json')
  //     //   .expect(200)
  //     //   .expect()

  //   //     let data = new Array<{ name?: string, desc:string }>();
  //   //     for (let subject of row.subjects) {
  //   //       if (subject[1]) {
  //   //         cache[row.target][]

  //   //       } else {
  //   //         data.push({
  //   //           desc: subject[0];
  //   //         });
  //   //       }
  //   //     }

  //   //     let data = new Array<{name: string, required: boolean}>();
  //   //     for (let subject of row.subjects) {
  //   //       data.push({
  //   //         name: subject[0],
  //   //         required: subject[1],
  //   //       });
  //   //     }

  //       const agent = await requestFor(handler, row.user);
  //       await agent
  //         .put(`/checklists/subjects`)
  //         .set('Accept', 'application/json')
  //         .set('Content-Type', 'application/json')
  //         .send({ data: data })
  //         .expect(row.status)
  //         .expect(expectPackage());

  //     });

  //   }

  // });

  // describe('Update checklist subjects', () => {
  //   let table: Array<{ target: string; user: string; subjects: Array<[string, boolean]>; status: number}> = [
  //     // User unauthenticated
  //     { target: '/devices/T99999-DEVA-0009-0099-S00001', user: '', subjects: [[ 'EE', false ]], status: 302 },
  //     // User unauthorized
  //     { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEAM', subjects: [[ 'EE', false ]], status: 403 },
  //     // Update Successful
  //     { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subjects: [[ 'EE', false ]], status: 200 },
  //     // Checklist subject mandatory
  //     { target: '/devices/T99999-DEVA-0009-0099-S00001', user: 'FEDM', subjects: [[ 'DO', false ]], status: 400 },
  //   ];

  //   for (let row of table) {
  //     it(`User '${row.user || 'Anonymous'}' disable checklist subject(s): ${JSON.stringify(row.subjects)}`, async () => {
  //       let checklistId = 'UNKNOWN';
  //       await request(handler)
  //         .get(row.target)
  //         .set('Accept', 'application/json')
  //         .expect(200)
  //         .expect((res: request.Response) => {
  //           checklistId = res.body.checklistId;
  //         });

  //       let data = new Array<{name: string, required: boolean}>();
  //       for (let subject of row.subjects) {
  //         data.push({
  //           name: subject[0],
  //           required: subject[1],
  //         });
  //       }

  //       const agent = await requestFor(handler, row.user);
  //       await agent
  //         .put(`/checklists/${checklistId}/subjects`)
  //         .set('Accept', 'application/json')
  //         .set('Content-Type', 'application/json')
  //         .send({ data: data })
  //         .expect(row.status)
  //         .expect(expectPackage());
  //     });
  //   }

  // });

});

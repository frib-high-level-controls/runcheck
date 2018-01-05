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
      }
    }
  };
};

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

  describe('Install Device into Slots', () => {
    let table = [
      // User unauthenticated
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: '', status: 302, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: '', status: 302, by: 'ID' },
      // User unauthorized
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEDM', status: 403, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEDM', status: 403, by: 'ID' },
      // Device type incompatible
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 400, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 400, by: 'ID' },
      // Installation date missing or invalid
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: undefined,    user: 'FEAM', status: 400, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '',           user: 'FEAM', status: 400, by: 'ID' },
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVB-0009-0099-S00002', date: '2017',       user: 'FEAM', status: 400, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-13-20', user: 'FEAM', status: 400, by: 'ID' },
      // Installation OK
      { name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 200 },
      { name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 200 },
      // Already installed
      //{ name: 'FE_TEST:DEVA_D0001', device: 'T99999-DEVA-0009-0099-S00001', date: '2017-11-20', user: 'FEAM', status: 400, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', device: 'T99999-DEVB-0009-0099-S00002', date: '2017-11-20', user: 'FEAM', status: 400, by: 'ID' },
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
        //const nameOrId = await getSlotNameOrId(row);
        //const deviceId = await getDeviceId(row);
        const agent = await requestFor(handler, row.user);
        return agent
          .put(`/slots/${row.name}/installation`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: {
              installDeviceId: deviceId,
              installDeviceOn: row.date,
            },
          })
          .expect(row.status)
          .expect(expectPackage({ installDeviceOn: row.date }));
      });
    }
  });

  describe('Assign checklist', () => {
    let table = [
      // User unauthorized
      //{ name: 'FE_TEST:DEVA_D0001', user: '',     status: 403, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', user: '',     status: 403, by: 'ID' },
      //{ name: 'FE_TEST:DEVA_D0001', user: 'FEDM', status: 403, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', user: 'FEDM', status: 403, by: 'ID' },
      // Assign OK
      { name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 201 },
      { name: 'FE_TEST:DEVB_D0002', user: 'FEAM', status: 201 },
      // Already assigned
      //{ name: 'FE_TEST:DEVA_D0001', user: 'FEAM', status: 400, by: 'name' },
      //{ name: 'FE_TEST:DEVB_D0002', user: 'FEAM', status: 400, by: 'ID' },
    ];
    for (let row of table) {
      it(`User '${row.user || 'Anonymous'}' assign checklist to ${row.name}`, async () => {
        //const nameOrId = await getSlotNameOrId(row);
        const agent = await requestFor(handler, row.user);
        await agent
          .put(`/slots/${row.name}/checklistId`)
          .set('Accept', 'application/json')
          .expect(row.status)
          .expect(expectPackage());
          // TODO: Confirm the checklist TYPE!!
      });
    }
  });


  describe('Modify checklist subjects', () => {
    let table = [
      { target: '/slots/FE_TEST:DEVA_D0001', user: '', subject: 'EE', data: { required: false }, status: 200 },
    ];
    for (let row of table) {
      it(`User ${row.user || '\'Anonymous\''} modify checklist subject`, async () => {
        let checklistId: string | undefined;
        await request(handler)
          .get(row.target)
          .set('Accept', 'application/json')
          .expect(200)
          .expect((res: request.Response) => {
            console.log(res.body);
            assert.isObject(res.body);
            assert.isObject(res.body.data);
            assert.isString(res.body.data.checklistId);
            checklistId = String(res.body.data.checklistId);
          });
        const agent = await requestFor(handler, row.user);
        await agent
          .put(`/checklists/${checklistId}/subject/${row.subject}`)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          .send({ data: row.data })
          .expect(row.status)
          .expect(expectPackage());
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

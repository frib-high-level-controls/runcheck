/**
 * Launch a dedicated instance of MongoDB for automated testing.
 */

import { ChildProcess, spawn } from 'child_process';

import * as Debug from 'debug';
import * as portfinder from 'portfinder';
import * as tmp from 'tmp';

import { info, warn } from '../../app/shared/logging';

const debug = Debug('webapp:mongod');

let mongod: ChildProcess | null;

let dbpath: string | undefined;

let dbpathCleanup: () => void | undefined;


/* Try to ensure that temporary directory always gets removed! */
process.on('exit', cleanupDBPath);
process.on('SIGINT', cleanupDBPath);
process.on('SIGTERM', cleanupDBPath);

/**
 * Start the MongoDB server instance on dedicated port.
 *
 * Note that startup generally takes at least 2 seconds,
 * which is longer than the default Mocha timeout!
 */
export async function start(options?: {}): Promise<number> {

  options = options || {};

  if (mongod) {
    throw new Error('MongoDB has already been started');
  }

  const dbargs: string[] = [];

  [dbpath, dbpathCleanup] = await new Promise<[string, () => void]>((resolve, reject) => {
    tmp.dir((err, path, cleanup) => {
      if (err) {
        reject(err);
        return;
      }
      resolve([path, cleanup]);
    });
  });
  dbargs.push('--dbpath', dbpath);


  const dbport = await new Promise<number>((resolve, reject) => {
    portfinder.getPort({ port: 37017 }, (err, port) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(port);
    });
  });
  dbargs.push('--port', String(dbport));


  return new Promise<number>((resolve, reject) => {
    const dbout = Debug(`${debug.namespace}:stdout`);
    const dberr = Debug(`${debug.namespace}:stderr`);

    info('Starting MongoDB: %s %s', 'mongod', dbargs.join(' '));
    mongod = spawn('mongod', dbargs);

    mongod.on('exit', (code, sig) => {
      if (code === 0) {
        info('MongoDB exit with code: %s, signal: %s', code, sig);
      } else {
        warn('MongoDB exit with code: %s, signal: %s', code, sig);
      }
      mongod = null;
      reject(new Error('MongoDB terminated before startup completed'));
    });

    mongod.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (line) {
          if (line.endsWith(`port ${dbport}`)) {
            debug('MongoDB is now listening on port %s', dbport);
            resolve(dbport);
          }
          dbout(line);
        }
      }
    });

    mongod.stderr.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (line) {
          dberr(line);
        }
      }
    });
  });
}

/**
 * Stop the running MongoDB server (send kill signal).
 */
export async function stop() {
  return new Promise((resolve, reject) => {
    if (!mongod) {
      throw new Error('MongoDB has not been started');
    }
    mongod.on('exit', (code, sig) => {
      if (code !== 0) {
        reject(new Error(`MongoDB exit with code: ${code}, signal: ${sig}`));
      }
      resolve();
    });
    mongod.kill();
  });
}

function cleanupDBPath() {
  if (dbpath && dbpathCleanup) {
    debug('Cleanup temporary dbpath: %s', dbpath);
    dbpathCleanup();
  }
}

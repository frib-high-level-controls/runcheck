/**
 * Utility to ensure the latest database schema.
 */
import * as log from '../shared/logging';


import {
  Slot,
} from '../models/slot';

export async function migrate() {
  // Initialize 'machineModes' field for existing Slots
  const prms = new Array<Promise<void>>();
  const slots = await Slot.find({ machineModes: { $exists: false }});
  for (const slot of slots) {
      // default machineModes will be set automatically by the schema
      prms.push(slot.saveWithHistory('SYS:MIGRATE').then((s) => {
        log.info('Migrate: Initialize Slot (Name: %s) machineModes: [%s]', s.name, s.machineModes);
      }));
  }
  await Promise.all(prms);
}

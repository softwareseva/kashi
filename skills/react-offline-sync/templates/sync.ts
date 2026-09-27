/** Sync wiring: the notes RxDB collection as a TanStack DB collection, plus the engine that pushes/pulls it. */
import type { RxCollection } from "rxdb";
import { SyncEngine, type LocalSyncEntity } from "@softwareseva/sync/client";
import { createSyncedCollection } from "@softwareseva/sync/react";
import { api } from "./api";
import { getDb, type Note } from "./database";

const db = await getDb();
const notesCollection = db.collections.notes as RxCollection<Note>;

/** Server rows -> local rows. Server wins; the engine skips rows whose id has a pending outbox op. */
const notesEntity: LocalSyncEntity = {
  upsert: async (rows) => { await notesCollection.bulkUpsert(rows); },
  delete: async (ids) => { await notesCollection.bulkRemove(ids); },
  clear: async () => { await notesCollection.find().remove(); },
};

export const syncEngine = new SyncEngine({
  db,
  api,
  entities: { notes: notesEntity },
});

/** Reads are live off RxDB; `notes.insert/update/delete` write locally and enqueue the matching op. */
export const notesCollectionDb = createSyncedCollection<Note>({
  id: "notes",
  entity: "notes",
  rxCollection: notesCollection,
  engine: syncEngine,
});

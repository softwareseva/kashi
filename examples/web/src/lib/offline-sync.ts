/** Offline notes: the RxDB collection as a TanStack DB collection, plus the engine that pushes/pulls it against the same /sync endpoints the online notes directory's API talks to. */
import type { RxCollection } from "rxdb";
import { SyncEngine, type LocalSyncEntity } from "@softwareseva/sync/client";
import { createSyncedCollection } from "@softwareseva/sync/react";
import { api } from "./api";
import { getOfflineDb, type OfflineNote } from "./offline-db";

const db = await getOfflineDb();
const notesCollection = db.collections.notes as RxCollection<OfflineNote>;

/** Server rows -> local rows. Server wins; the engine skips rows whose id has a pending outbox op. */
const notesEntity: LocalSyncEntity = {
  upsert: async (rows) => { await notesCollection.bulkUpsert(rows); },
  delete: async (ids) => { await notesCollection.bulkRemove(ids); },
  clear: async () => { await notesCollection.find().remove(); },
};

export const offlineSyncEngine = new SyncEngine({ db, api, entities: { notes: notesEntity } });

/** Reads are live off RxDB; `offlineNotes.insert/update/delete` write locally and enqueue the matching op. */
export const offlineNotes = createSyncedCollection<OfflineNote>({
  id: "offline-notes",
  entity: "notes",
  rxCollection: notesCollection,
  engine: offlineSyncEngine,
});

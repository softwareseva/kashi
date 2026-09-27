/** RxDB database for the offline notes demo. SyncEngine adds kashi_outbox and kashi_sync_state itself. */
import { createRxDatabase, type RxDatabase, type RxJsonSchema } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

export type OfflineNote = { id: string; title: string; body: string; updatedAt: string };

const noteSchema: RxJsonSchema<OfflineNote> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 64 },
    title: { type: "string" },
    body: { type: "string" },
    updatedAt: { type: "string" },
  },
  required: ["id", "title", "body", "updatedAt"],
};

let dbPromise: Promise<RxDatabase> | null = null;

/** One database per tab; call once and share the result. */
export function getOfflineDb(): Promise<RxDatabase> {
  dbPromise ??= createRxDatabase({ name: "kashi_example_offline", storage: getRxStorageDexie() }).then(async (db) => {
    await db.addCollections({ notes: { schema: noteSchema } });
    return db;
  });
  return dbPromise;
}

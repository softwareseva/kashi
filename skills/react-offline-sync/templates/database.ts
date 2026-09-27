/** RxDB database: the app's own collections. SyncEngine adds kashi_outbox and kashi_sync_state itself. */
import { createRxDatabase, type RxDatabase, type RxJsonSchema } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

export type Note = { id: string; title: string; body: string; updatedAt: string };

const noteSchema: RxJsonSchema<Note> = {
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

/** One database per tab; call once at app startup and share the result. */
export function getDb(): Promise<RxDatabase> {
  dbPromise ??= createRxDatabase({ name: "kashi_example", storage: getRxStorageDexie() }).then(async (db) => {
    await db.addCollections({ notes: { schema: noteSchema } });
    return db;
  });
  return dbPromise;
}

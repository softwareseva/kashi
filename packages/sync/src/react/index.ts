/** @softwareseva/sync/react — a TanStack DB collection whose durable source is an RxDB collection, and a status hook for SyncEngine. Reads are live (RxDB's own reactive query drives the collection); writes go through RxDB and enqueue an op on the SyncEngine in the same call. */
import { useSyncExternalStore } from "react";
import { createCollection } from "@tanstack/db";
import type { RxCollection } from "rxdb";
import type { SyncEngine, SyncStatus } from "../client/index";

export type SyncedCollectionOptions<T extends { id: string }> = {
  /** Unique id for this collection within the app, e.g. "notes". */
  id: string;
  /** Op type prefix; upserts send `${entity}.upsert`, deletes send `${entity}.delete`. */
  entity: string;
  rxCollection: RxCollection<T>;
  engine: SyncEngine;
  /** Build the op payload sent to the server for an insert/update (default: the row itself). */
  toUpsertPayload?: (row: T) => unknown;
};

/** Local-first: `collection.insert/update/delete` write to RxDB immediately (optimistic, durable) and enqueue the matching sync op; the live RxDB query keeps every other read of the collection current, including rows pulled in from the server. */
export function createSyncedCollection<T extends { id: string }>(options: SyncedCollectionOptions<T>) {
  const { id, entity, rxCollection, engine, toUpsertPayload = (row: T) => row } = options;

  return createCollection<T>({
    id,
    getKey: (row) => row.id,
    sync: {
      sync: ({ begin, write, commit, markReady, truncate }) => {
        let ready = false;
        // Full-refresh on every RxDB emission: truncate then re-insert, so this never has to reconcile against what the collection already holds.
        const subscription = rxCollection.find().$.subscribe((docs) => {
          begin();
          truncate();
          for (const doc of docs) write({ type: "insert", value: doc.toJSON() as T });
          commit();
          if (!ready) { markReady(); ready = true; }
        });
        return () => subscription.unsubscribe();
      },
    },
    onInsert: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        const row = mutation.modified as T;
        await rxCollection.upsert(row);
        await engine.enqueue(`${entity}.upsert`, toUpsertPayload(row), { entity, entityId: row.id });
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        const row = mutation.modified as T;
        await rxCollection.upsert(row);
        await engine.enqueue(`${entity}.upsert`, toUpsertPayload(row), { entity, entityId: row.id });
      }
    },
    onDelete: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        const row = mutation.original as T;
        const doc = await rxCollection.findOne(row.id).exec();
        await doc?.remove();
        await engine.enqueue(`${entity}.delete`, { id: row.id }, { entity, entityId: row.id });
      }
    },
  });
}

/** Re-render whenever the engine's phase, pending count or needs-attention count changes. Feed to a status badge. */
export function useSyncStatus(engine: SyncEngine): SyncStatus {
  return useSyncExternalStore(engine.statusStream.subscribe, engine.getStatus, engine.getStatus);
}

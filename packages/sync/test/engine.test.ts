import { describe, expect, it, vi } from "vitest";
import { createRxDatabase, type RxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import type { ApiClient } from "@softwareseva/core/client";
import { SyncEngine, type LocalSyncEntity } from "../src/client/index";

let dbCounter = 0;
const makeDb = (): Promise<RxDatabase> => createRxDatabase({ name: `test_${dbCounter++}_${Date.now()}`, storage: getRxStorageMemory() });

function fakeApi(handlers: { post?: ApiClient["post"]; get?: ApiClient["get"] }): ApiClient {
  const notImplemented = () => { throw new Error("not implemented"); };
  return {
    request: notImplemented,
    get: handlers.get ?? notImplemented,
    post: handlers.post ?? notImplemented,
    put: notImplemented,
    patch: notImplemented,
    delete: notImplemented,
  };
}

const noPull = async () => ({ changes: {}, next: 0, hasMore: false, reset: false });
const entity = (): LocalSyncEntity => ({ upsert: vi.fn(), delete: vi.fn(), clear: vi.fn() });

describe("SyncEngine", () => {
  it("pushes a queued op and clears it from the outbox once applied", async () => {
    const db = await makeDb();
    const post = vi.fn(async (path: string, body: unknown) => {
      expect(path).toBe("/sync/push");
      const { ops } = body as { ops: Array<{ opId: string; type: string }> };
      return { results: ops.map((op) => ({ opId: op.opId, status: "applied" as const })) };
    });
    const notes = entity();
    const engine = new SyncEngine({ db, api: fakeApi({ post, get: noPull }), entities: { notes }, debounceMs: 100_000 });

    await engine.enqueue("note.upsert", { id: "n1", title: "hi" }, { entity: "notes", entityId: "n1" });
    expect(engine.getStatus().pending).toBe(1);

    await engine.sync();

    expect(post).toHaveBeenCalledTimes(1);
    expect(engine.getStatus()).toMatchObject({ phase: "idle", pending: 0, needsAttention: 0 });
  });

  it("moves a permanently failed op to needs-attention, and retry() re-queues it", async () => {
    const db = await makeDb();
    let attempt = 0;
    const post = vi.fn(async (_path: string, body: unknown) => {
      const { ops } = body as { ops: Array<{ opId: string }> };
      attempt += 1;
      if (attempt === 1) return { results: ops.map((op) => ({ opId: op.opId, status: "failed" as const, error: { retryable: false } })) };
      return { results: ops.map((op) => ({ opId: op.opId, status: "applied" as const })) };
    });
    const engine = new SyncEngine({ db, api: fakeApi({ post, get: noPull }), entities: { notes: entity() }, debounceMs: 100_000 });

    await engine.enqueue("note.delete", { id: "n1" }, { entity: "notes", entityId: "n1" });
    await engine.sync();
    expect(engine.getStatus()).toMatchObject({ pending: 0, needsAttention: 1 });

    const attention = await engine.needsAttention();
    expect(attention).toHaveLength(1);
    await engine.retry(attention[0]!.opId);
    expect(engine.getStatus()).toMatchObject({ pending: 1, needsAttention: 0 });

    await engine.sync();
    expect(engine.getStatus()).toMatchObject({ pending: 0, needsAttention: 0 });
  });

  it("applies pulled upserts and deletes to the local entity and advances the cursor", async () => {
    const db = await makeDb();
    const notes = entity();
    let calls = 0;
    const get = vi.fn(async (path: string) => {
      calls += 1;
      expect(path).toContain("/sync/pull");
      if (calls === 1) return { changes: { notes: { upserts: [{ id: "a", title: "A" }], deletes: ["b"] } }, next: 5, hasMore: false, reset: false };
      throw new Error("unexpected extra pull");
    });
    const engine = new SyncEngine({ db, api: fakeApi({ post: async () => ({ results: [] }), get }), entities: { notes }, debounceMs: 100_000 });

    await engine.sync();

    expect(notes.upsert).toHaveBeenCalledWith([{ id: "a", title: "A" }]);
    expect(notes.delete).toHaveBeenCalledWith(["b"]);
    expect(get).toHaveBeenCalledTimes(1);

    // A second sync with an unchanged cursor should ask for `since=5` and stop once hasMore is false.
    const get2 = vi.fn(async () => ({ changes: {}, next: 5, hasMore: false, reset: false }));
    const engine2 = new SyncEngine({ db, api: fakeApi({ post: async () => ({ results: [] }), get: get2 }), entities: { notes }, debounceMs: 100_000 });
    await engine2.sync();
    expect(get2).toHaveBeenCalledWith(expect.stringContaining("since=5"));
  });

  it("clearAll wipes entities, outbox and cursor", async () => {
    const db = await makeDb();
    const notes = entity();
    const engine = new SyncEngine({ db, api: fakeApi({ post: async () => ({ results: [] }), get: noPull }), entities: { notes }, debounceMs: 100_000 });
    await engine.enqueue("note.upsert", { id: "n1" }, { entity: "notes", entityId: "n1" });
    await engine.clearAll();
    expect(notes.clear).toHaveBeenCalledTimes(1);
    expect(engine.getStatus()).toMatchObject({ pending: 0, needsAttention: 0, lastSyncAt: null });
  });
});

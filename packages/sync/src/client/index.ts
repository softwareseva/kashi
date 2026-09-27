/** @softwareseva/sync/client — offline-first push/pull against a syncRouter, backed by RxDB for local durability. Mirrors kashi_sync's Dart engine: an outbox of ops and a pull cursor, both owned by the engine inside the app's RxDB database. */
import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb";
import type { ApiClient } from "@softwareseva/core/client";

export type LocalSyncEntity = {
  /** Server rows -> local rows. Server wins; the engine skips rows whose id has a pending outbox op. */
  upsert: (rows: Array<Record<string, unknown>>) => Promise<void>;
  delete: (ids: string[]) => Promise<void>;
  clear: () => Promise<void>;
};

export type SyncPhase = "idle" | "syncing" | "offline" | "failed";
export type SyncStatus = { phase: SyncPhase; pending: number; needsAttention: number; lastSyncAt: string | null; message?: string };

type OutboxDoc = {
  opId: string;
  type: string;
  payload: unknown;
  entity: string;
  entityId: string;
  status: "pending" | "needs-attention";
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
};
type CursorDoc = { id: string; since: number };

const outboxSchema: RxJsonSchema<OutboxDoc> = {
  version: 0,
  primaryKey: "opId",
  type: "object",
  properties: {
    opId: { type: "string", maxLength: 64 },
    type: { type: "string" },
    payload: {},
    entity: { type: "string" },
    entityId: { type: "string" },
    status: { type: "string" },
    attempts: { type: "number" },
    nextAttemptAt: { type: "string" },
    createdAt: { type: "string" },
  },
  required: ["opId", "type", "payload", "entity", "entityId", "status", "attempts", "nextAttemptAt", "createdAt"],
};

const cursorSchema: RxJsonSchema<CursorDoc> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: { id: { type: "string", maxLength: 16 }, since: { type: "number" } },
  required: ["id", "since"],
};

const CURSOR_ID = "cursor";

export type SyncEngineOptions = {
  /** The app's own RxDB database; the engine adds its `kashi_outbox` and `kashi_sync_state` collections to it. */
  db: RxDatabase;
  /** The same client used for the rest of the app; `/sync/push` and `/sync/pull` are appended to its base path. */
  api: ApiClient;
  entities: Record<string, LocalSyncEntity>;
  /** How often to sync while started (default 5 minutes). */
  intervalMs?: number;
  /** Debounce after `enqueue()` before syncing (default 400ms). */
  debounceMs?: number;
  maxAttempts?: number;
  pageSize?: number;
};

/** `sync()`: push due ops in batches of 50, then pull pages until `hasMore` is false. Concurrent calls share one run. */
export class SyncEngine {
  private readonly db: RxDatabase;
  private readonly api: ApiClient;
  private readonly entities: Record<string, LocalSyncEntity>;
  private readonly intervalMs: number;
  private readonly debounceMs: number;
  private readonly maxAttempts: number;
  private readonly pageSize: number;

  private outbox: RxCollection<OutboxDoc> | null = null;
  private cursor: RxCollection<CursorDoc> | null = null;
  private readonly ready: Promise<void>;

  private timer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();
  private status: SyncStatus = { phase: "idle", pending: 0, needsAttention: 0, lastSyncAt: null };

  constructor(options: SyncEngineOptions) {
    this.db = options.db;
    this.api = options.api;
    this.entities = options.entities;
    this.intervalMs = options.intervalMs ?? 5 * 60_000;
    this.debounceMs = options.debounceMs ?? 400;
    this.maxAttempts = options.maxAttempts ?? 8;
    this.pageSize = options.pageSize ?? 500;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const existing = this.db.collections as Record<string, unknown>;
    const toAdd: Record<string, { schema: RxJsonSchema<OutboxDoc> | RxJsonSchema<CursorDoc> }> = {};
    if (!existing.kashi_outbox) toAdd.kashi_outbox = { schema: outboxSchema };
    if (!existing.kashi_sync_state) toAdd.kashi_sync_state = { schema: cursorSchema };
    if (Object.keys(toAdd).length) await this.db.addCollections(toAdd);
    this.outbox = this.db.collections.kashi_outbox as RxCollection<OutboxDoc>;
    this.cursor = this.db.collections.kashi_sync_state as RxCollection<CursorDoc>;
    await this.refreshStatus();
  }

  /** `{subscribe}` shape so it plugs straight into `useSyncExternalStore`. */
  get statusStream(): { subscribe: (fn: () => void) => () => void } {
    return { subscribe: (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); } };
  }
  getStatus = (): SyncStatus => this.status;

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener();
  }

  private async refreshStatus(): Promise<void> {
    const pending = await this.outbox!.count({ selector: { status: "pending" } }).exec();
    const needsAttention = await this.outbox!.count({ selector: { status: "needs-attention" } }).exec();
    this.setStatus({ pending, needsAttention });
  }

  /** Write the local row first, then enqueue the op — in the same transaction where your storage supports one. */
  async enqueue(type: string, payload: unknown, target: { entity: string; entityId: string }): Promise<void> {
    await this.ready;
    await this.outbox!.insert({
      opId: newOpId(),
      type,
      payload,
      entity: target.entity,
      entityId: target.entityId,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(0).toISOString(),
      createdAt: new Date().toISOString(),
    });
    await this.refreshStatus();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.sync(), this.debounceMs);
  }

  /** Sync now, every `intervalMs`, and whenever the browser comes back online. */
  start(): void {
    void this.sync();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.sync(), this.intervalMs);
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
  }

  private onOnline = (): void => void this.sync();

  sync(): Promise<void> {
    this.inFlight ??= this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async run(): Promise<void> {
    await this.ready;
    if (typeof navigator !== "undefined" && navigator.onLine === false) { this.setStatus({ phase: "offline" }); return; }
    this.setStatus({ phase: "syncing" });
    try {
      await this.push();
      await this.pull();
      this.setStatus({ phase: "idle", lastSyncAt: new Date().toISOString() });
    } catch (error) {
      this.setStatus({ phase: "failed", message: error instanceof Error ? error.message : "Sync failed." });
    }
    await this.refreshStatus();
  }

  private async push(): Promise<void> {
    for (;;) {
      const now = new Date().toISOString();
      const due = await this.outbox!.find({ selector: { status: "pending", nextAttemptAt: { $lte: now } }, limit: 50 }).exec();
      if (!due.length) return;
      const ops = due.map((d) => ({ opId: d.opId, type: d.type, payload: d.payload }));
      const { results } = await this.api.post<{ results: Array<{ opId: string; status: "applied" | "replayed" | "failed"; error?: { retryable: boolean } }> }>("/sync/push", { ops });
      for (const result of results) {
        const doc = due.find((d) => d.opId === result.opId);
        if (!doc) continue;
        if (result.status === "applied" || result.status === "replayed") { await doc.remove(); continue; }
        const attempts = doc.attempts + 1;
        if (result.error?.retryable && attempts < this.maxAttempts) {
          const delay = Math.min(5_000 * 2 ** attempts, 5 * 60_000);
          await doc.incrementalPatch({ attempts, nextAttemptAt: new Date(Date.now() + delay).toISOString() });
        } else {
          await doc.incrementalPatch({ attempts, status: "needs-attention" });
        }
      }
      if (due.length < 50) return;
    }
  }

  private async pull(): Promise<void> {
    for (;;) {
      const cursorDoc = await this.cursor!.findOne(CURSOR_ID).exec();
      const since = cursorDoc?.since ?? 0;
      const page = await this.api.get<{ changes: Record<string, { upserts: Array<{ id: string } & Record<string, unknown>>; deletes: string[] }>; next: number; hasMore: boolean; reset: boolean }>(`/sync/pull?since=${since}&limit=${this.pageSize}`);
      if (page.reset) {
        for (const entity of Object.values(this.entities)) await entity.clear();
        await this.cursor!.upsert({ id: CURSOR_ID, since: 0 });
        continue;
      }
      const pendingOps = await this.outbox!.find({ selector: { status: "pending" } }).exec();
      const pendingKeys = new Set(pendingOps.map((d) => `${d.entity}:${d.entityId}`));
      for (const [entityName, change] of Object.entries(page.changes)) {
        const entity = this.entities[entityName];
        if (!entity) continue;
        const upserts = change.upserts.filter((row) => !pendingKeys.has(`${entityName}:${row.id}`));
        const deletes = change.deletes.filter((id) => !pendingKeys.has(`${entityName}:${id}`));
        if (upserts.length) await entity.upsert(upserts);
        if (deletes.length) await entity.delete(deletes);
      }
      await this.cursor!.upsert({ id: CURSOR_ID, since: page.next });
      if (!page.hasMore) return;
    }
  }

  async needsAttention(): Promise<Array<{ opId: string; type: string; entity: string; entityId: string; attempts: number }>> {
    await this.ready;
    const docs = await this.outbox!.find({ selector: { status: "needs-attention" } }).exec();
    return docs.map((d) => ({ opId: d.opId, type: d.type, entity: d.entity, entityId: d.entityId, attempts: d.attempts }));
  }

  async retry(opId: string): Promise<void> {
    await this.ready;
    const doc = await this.outbox!.findOne(opId).exec();
    if (doc) await doc.incrementalPatch({ status: "pending", attempts: 0, nextAttemptAt: new Date(0).toISOString() });
    await this.refreshStatus();
    void this.sync();
  }

  async discard(opId: string): Promise<void> {
    await this.ready;
    const doc = await this.outbox!.findOne(opId).exec();
    if (doc) await doc.remove();
    await this.refreshStatus();
  }

  /** Wipe local synced data and the outbox/cursor. Call on sign-out before another user signs in on this device. */
  async clearAll(): Promise<void> {
    await this.ready;
    this.stop();
    for (const entity of Object.values(this.entities)) await entity.clear();
    await this.outbox!.find().remove();
    await this.cursor!.find().remove();
    this.setStatus({ phase: "idle", pending: 0, needsAttention: 0, lastSyncAt: null });
  }
}

function newOpId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

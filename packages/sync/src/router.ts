/** syncRouter(config): POST /push applies client operations exactly once; GET /pull streams changes after a cursor. */
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z, type ZodType } from "zod";
import { ApiError, nowIso, ok } from "@kashi/core/server";
import { changeStatement, type Change } from "./changes";

export type SyncUser = { id: string };

export type HandlerContext<U extends SyncUser> = {
  db: D1Database;
  user: U;
  c: Context;
  /** Statements to commit atomically with the change entries. */
  batch: D1PreparedStatement[];
  /** Record a change; it is committed with `batch`. */
  changed: (change: Change) => void;
};

export type SyncHandler<U extends SyncUser, P> = {
  schema: ZodType<P>;
  /** Push statements onto ctx.batch and call ctx.changed; return what the client should see. Throw ApiError to reject. */
  apply: (ctx: HandlerContext<U>, payload: P) => Promise<unknown> | unknown;
};

export type SyncEntity<U extends SyncUser> = {
  /** Load current rows by id for this user. Rows not returned (missing, soft-deleted, out of scope) are sent as deletes. */
  load: (db: D1Database, ids: string[], user: U) => Promise<Array<{ id: string } & Record<string, unknown>>>;
};

export type SyncConfig<U extends SyncUser> = {
  /** Middleware that authenticates (e.g. requireAuth from @kashi/auth). */
  auth: MiddlewareHandler;
  /** Read the user set by `auth`. */
  user: (c: Context) => U;
  /** Scopes this user may pull, e.g. [`user:${id}`, `org:${orgId}`]. */
  scopes: (user: U, c: Context) => string[] | Promise<string[]>;
  handlers: Record<string, SyncHandler<U, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
  entities: Record<string, SyncEntity<U>>;
  /** Max ops per push (default 100) and changes per pull page (default 500). */
  maxOps?: number;
  pageSize?: number;
  db?: (c: Context) => D1Database;
};

const pushSchema = (max: number) => z.object({
  ops: z.array(z.object({ opId: z.string().min(8).max(64), type: z.string().min(1).max(64), payload: z.unknown(), clientTs: z.number().int().optional() })).min(1).max(max),
});

export type PushResult = { opId: string; status: "applied" | "replayed" | "failed"; result?: unknown; error?: { code: string; message: string; retryable: boolean } };

export function syncRouter<U extends SyncUser>(config: SyncConfig<U>) {
  const app = new Hono();
  const dbOf = (c: Context) => (config.db ? config.db(c) : (c.env as { DB: D1Database }).DB);
  app.use("*", config.auth);

  app.post("/push", async (c) => {
    const db = dbOf(c);
    const user = config.user(c);
    const { ops } = pushSchema(config.maxOps ?? 100).parse(await c.req.json());
    const results: PushResult[] = [];
    for (const op of ops) {
      const stored = await db.prepare("SELECT result FROM sync_ops WHERE user_id = ? AND op_id = ?").bind(user.id, op.opId).first<{ result: string | null }>();
      if (stored) { results.push({ opId: op.opId, status: "replayed", result: stored.result ? JSON.parse(stored.result) : null }); continue; }
      const handler = config.handlers[op.type];
      if (!handler) { results.push({ opId: op.opId, status: "failed", error: { code: "UNKNOWN_OP", message: `Unknown operation ${op.type}.`, retryable: false } }); continue; }
      try {
        const payload = handler.schema.parse(op.payload);
        const ctx: HandlerContext<U> = { db, user, c, batch: [], changed: (ch) => ctx.batch.push(changeStatement(db, ch)) };
        const result = (await handler.apply(ctx, payload)) ?? null;
        ctx.batch.push(db.prepare("INSERT INTO sync_ops(op_id, user_id, type, result, created_at) VALUES (?, ?, ?, ?, ?)").bind(op.opId, user.id, op.type, JSON.stringify(result), nowIso()));
        await db.batch(ctx.batch);
        results.push({ opId: op.opId, status: "applied", result });
      } catch (error) {
        results.push({ opId: op.opId, status: "failed", error: toOpError(error) });
      }
    }
    return ok(c, { results });
  });

  app.get("/pull", async (c) => {
    const db = dbOf(c);
    const user = config.user(c);
    const since = Math.max(0, Number(c.req.query("since") ?? 0) || 0);
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? config.pageSize ?? 500) || 500, 1), 1000);
    const scopes = await config.scopes(user, c);
    if (!scopes.length) return ok(c, { changes: {}, next: since, hasMore: false, reset: false });

    // A cursor older than the oldest retained change means entries were pruned: tell the client to resync.
    const oldest = await db.prepare("SELECT min(seq) AS seq FROM sync_changes").first<{ seq: number | null }>();
    const reset = since > 0 && oldest?.seq != null && since < oldest.seq - 1;
    const from = reset ? 0 : since;

    const marks = scopes.map(() => "?").join(",");
    const rows = (await db.prepare(`SELECT seq, entity, entity_id, op FROM sync_changes WHERE scope IN (${marks}) AND seq > ? ORDER BY seq LIMIT ?`).bind(...scopes, from, limit + 1).all<{ seq: number; entity: string; entity_id: string; op: "upsert" | "delete" }>()).results;
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const next = page.length ? page[page.length - 1]!.seq : from;

    // Latest op per (entity, id) inside the page wins.
    const latest = new Map<string, Map<string, "upsert" | "delete">>();
    for (const r of page) {
      if (!config.entities[r.entity]) continue;
      (latest.get(r.entity) ?? latest.set(r.entity, new Map()).get(r.entity)!).set(r.entity_id, r.op);
    }
    const changes: Record<string, { upserts: unknown[]; deletes: string[] }> = {};
    for (const [entity, ops] of latest) {
      const upsertIds = [...ops].filter(([, op]) => op === "upsert").map(([id]) => id);
      const deletes = [...ops].filter(([, op]) => op === "delete").map(([id]) => id);
      const loaded = upsertIds.length ? await loadChunked(config.entities[entity]!, db, upsertIds, user) : [];
      const found = new Set(loaded.map((r) => r.id));
      changes[entity] = { upserts: loaded, deletes: [...deletes, ...upsertIds.filter((id) => !found.has(id))] };
    }
    return ok(c, { changes, next, hasMore, reset });
  });

  return app;
}

/** D1 allows 100 bound parameters per statement; load in chunks. */
async function loadChunked<U extends SyncUser>(entity: SyncEntity<U>, db: D1Database, ids: string[], user: U) {
  const out: Array<{ id: string } & Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 90) out.push(...(await entity.load(db, ids.slice(i, i + 90), user)));
  return out;
}

function toOpError(error: unknown): { code: string; message: string; retryable: boolean } {
  if (error instanceof ApiError) return { code: error.code, message: error.message, retryable: error.status === 429 || error.status >= 500 };
  if (error instanceof z.ZodError) return { code: "VALIDATION_ERROR", message: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), retryable: false };
  console.error(JSON.stringify({ level: "error", where: "sync.push", message: error instanceof Error ? error.message : String(error) }));
  return { code: "INTERNAL_ERROR", message: "The server could not apply this change.", retryable: true };
}

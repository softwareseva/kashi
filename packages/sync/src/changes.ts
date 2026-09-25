/** Record changes to the sync log. Call from sync handlers and from ordinary online routes alike. */
import { nowIso } from "@kashi/core/server";

export type ChangeOp = "upsert" | "delete";
export type Change = { scope: string; entity: string; id: string; op?: ChangeOp };

/** A prepared statement that appends one change; put it in the same `db.batch()` as the write it describes. */
export function changeStatement(db: D1Database, change: Change): D1PreparedStatement {
  return db.prepare("INSERT INTO sync_changes(scope, entity, entity_id, op, changed_at) VALUES (?, ?, ?, ?, ?)").bind(change.scope, change.entity, change.id, change.op ?? "upsert", nowIso());
}

/** Append changes on their own (prefer `changeStatement` inside a batch so the write and the log commit together). */
export async function recordChanges(db: D1Database, changes: Change[]): Promise<void> {
  if (changes.length) await db.batch(changes.map((ch) => changeStatement(db, ch)));
}

/** Delete log entries older than `days`. Clients whose cursor is older must resync from 0 (the pull answers `reset: true`). */
export async function pruneChanges(db: D1Database, days = 90): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM sync_changes WHERE changed_at < ?").bind(cutoff),
    db.prepare("DELETE FROM sync_ops WHERE created_at < ?").bind(cutoff),
  ]);
}

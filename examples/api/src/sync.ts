/** Sync configuration: note operations clients may push, and how pulled notes are loaded. */
import { z } from "zod";
import { ApiError, nowIso } from "@kashi/core/server";
import { requireAuth, type AuthUser } from "@kashi/auth/server";
import { syncRouter } from "@kashi/sync";
import { authConfig } from "./auth";

/** Notes are shared by everyone in this example; real apps scope per user or organisation. */
export const NOTES_SCOPE = "global";

const upsert = z.object({ id: z.string().min(3).max(64), title: z.string().trim().min(1).max(200), body: z.string().max(10_000).default("") });
const remove = z.object({ id: z.string().min(3).max(64) });

export const syncRoutes = syncRouter<AuthUser>({
  auth: requireAuth(authConfig),
  user: (c) => c.get("user") as AuthUser,
  scopes: () => [NOTES_SCOPE],
  handlers: {
    "note.upsert": {
      schema: upsert,
      apply: (ctx, p) => {
        const now = nowIso();
        ctx.batch.push(ctx.db.prepare("INSERT INTO notes(id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at, deleted_at = NULL").bind(p.id, p.title, p.body, now, now));
        ctx.changed({ scope: NOTES_SCOPE, entity: "notes", id: p.id });
        return { id: p.id, updatedAt: now };
      },
    },
    "note.delete": {
      schema: remove,
      apply: async (ctx, p) => {
        const exists = await ctx.db.prepare("SELECT 1 FROM notes WHERE id = ?").bind(p.id).first();
        if (!exists) throw new ApiError(404, "NOT_FOUND", "Note not found.");
        ctx.batch.push(ctx.db.prepare("UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(nowIso(), nowIso(), p.id));
        ctx.changed({ scope: NOTES_SCOPE, entity: "notes", id: p.id, op: "delete" });
        return { id: p.id };
      },
    },
  },
  entities: {
    notes: {
      load: async (db, ids) => {
        const marks = ids.map(() => "?").join(",");
        return (await db.prepare(`SELECT id, title, body, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE deleted_at IS NULL AND id IN (${marks})`).bind(...ids).all<{ id: string } & Record<string, unknown>>()).results;
      },
    },
  },
});

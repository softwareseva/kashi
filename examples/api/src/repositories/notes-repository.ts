/** All SQL for notes. Sort keys are an allowlist; search is an escaped LIKE. */
import { likeAny, likePattern, newId, nowIso } from "@kashi/core/server";
import { listKeyset, type ListQuery, type Page } from "@kashi/list/server";

export type NoteRow = { id: string; title: string; body: string; createdAt: string; updatedAt: string };
export type NoteSort = "title" | "updatedAt";
const sortColumns: Record<NoteSort, string> = { title: "title", updatedAt: "updated_at" };
const columns = "id, title, body, created_at AS createdAt, updated_at AS updatedAt";

export class NotesRepository {
  constructor(private readonly db: D1Database) {}

  list(query: ListQuery<NoteSort>): Promise<Page<NoteRow>> {
    return listKeyset<NoteRow, NoteSort>({
      db: this.db,
      sql: `SELECT ${columns} FROM notes WHERE deleted_at IS NULL AND ${likeAny(["title", "body"])}`,
      bindings: [likePattern(query.q), likePattern(query.q)],
      sortColumns,
      ...query,
    });
  }

  get(id: string): Promise<NoteRow | null> {
    return this.db.prepare(`SELECT ${columns} FROM notes WHERE id = ? AND deleted_at IS NULL`).bind(id).first<NoteRow>();
  }

  async create(input: { title: string; body: string }): Promise<NoteRow> {
    const id = newId("note"); const now = nowIso();
    await this.db.prepare("INSERT INTO notes(id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(id, input.title, input.body, now, now).run();
    return { id, title: input.title, body: input.body, createdAt: now, updatedAt: now };
  }
}

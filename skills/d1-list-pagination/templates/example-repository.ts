/** Keyset list with escaped search and an allowlisted sort map. */
import { likeAny, likePattern } from "@softwareseva/core/server";
import { listKeyset, type ListQuery, type Page } from "@softwareseva/list/server";

export type NoteRow = { id: string; title: string; updatedAt: string };
export type NoteSort = "title" | "updatedAt";
const sortColumns: Record<NoteSort, string> = { title: "title", updatedAt: "updated_at" };

export class NotesRepository {
  constructor(private readonly db: D1Database) {}

  list(query: ListQuery<NoteSort>): Promise<Page<NoteRow>> {
    return listKeyset<NoteRow, NoteSort>({
      db: this.db,
      sql: `SELECT id, title, updated_at AS updatedAt FROM notes WHERE deleted_at IS NULL AND ${likeAny(["title", "body"])}`,
      bindings: [likePattern(query.q), likePattern(query.q)],
      sortColumns,
      ...query,
    });
  }
}

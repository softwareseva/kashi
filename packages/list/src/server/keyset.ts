/** Two-way keyset pagination on `(sort_column, id)` for D1. */
import type { Page, SortDirection } from "../contracts/index";
import { type Cursor, decodeCursor, encodeCursor } from "./cursor";

export type KeysetOptions = {
  /** SQL expression for the sort key, from a server-owned allowlist (never user input). */
  column: string;
  direction: SortDirection;
  /** Decoded cursor, or the raw string from the query (decoded here). */
  cursor?: Cursor | string | null;
  /** Tie-breaker column, default `id`. */
  idColumn?: string;
};

export type Keyset = {
  /** `(col > ? OR (col = ? AND id > ?))` or "" when there is no cursor. Prefix with AND/WHERE yourself. */
  where: string;
  /** Bindings for `where`, in order: value, value, id (or none). */
  bindings: (string | number)[];
  /** `col ASC, id ASC` (flipped when paging backwards). */
  orderBy: string;
  cursor: Cursor | null;
};

/** Build the WHERE fragment, bindings and ORDER BY for a keyset query. Fetch `limit + 1` rows, then call `finishPage`. */
export function keyset(options: KeysetOptions): Keyset {
  const cursor = typeof options.cursor === "string" || options.cursor == null ? decodeCursor(options.cursor) : options.cursor;
  const idColumn = options.idColumn ?? "id";
  const reverse = cursor?.mode === "previous";
  const effective = reverse ? (options.direction === "asc" ? "desc" : "asc") : options.direction;
  const cmp = effective === "asc" ? ">" : "<";
  const dir = effective.toUpperCase();
  return {
    where: cursor ? `(${options.column} ${cmp} ? OR (${options.column} = ? AND ${idColumn} ${cmp} ?))` : "",
    bindings: cursor ? [cursor.value, cursor.value, cursor.id] : [],
    orderBy: `${options.column} ${dir}, ${idColumn} ${dir}`,
    cursor,
  };
}

/**
 * Turn `limit + 1` fetched rows into a page with next/previous cursors.
 * `sortValue` returns the row's value for the current sort key (must match `column`).
 */
export function finishPage<T extends { id: string }>(rows: T[], limit: number, cursor: Cursor | null, sortValue: (row: T) => string | number): Page<T> {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const backwards = cursor?.mode === "previous";
  if (backwards) items.reverse();
  const first = items[0];
  const last = items[items.length - 1];
  const hasNext = backwards ? items.length > 0 : hasMore;
  const hasPrevious = backwards ? hasMore : cursor !== null;
  return {
    items,
    next: hasNext && last ? encodeCursor({ value: sortValue(last), id: last.id, mode: "next" }) : null,
    previous: hasPrevious && first ? encodeCursor({ value: sortValue(first), id: first.id, mode: "previous" }) : null,
  };
}

export type KeysetListOptions<T extends { id: string }, S extends string> = {
  db: D1Database;
  /** `SELECT ... FROM ... WHERE <filters>` without ORDER BY or LIMIT. Must select `id` and the sort columns. */
  sql: string;
  /** Bindings for the filters in `sql`. */
  bindings?: (string | number | null)[];
  /** Map of allowed sort keys to SQL expressions. */
  sortColumns: Record<S, string>;
  sort: S;
  direction: SortDirection;
  limit: number;
  cursor?: string | null;
  /** Row -> sort value; defaults to `row[sort]` which works when the SELECT aliases columns to the sort keys. */
  sortValue?: (row: T) => string | number;
  /** Optional row mapper (e.g. cast integers to booleans). */
  map?: (row: T) => T;
  idColumn?: string;
};

/**
 * Run a keyset list in one call. `sql` already contains its WHERE clause (or none); the keyset predicate is appended.
 *
 * ```ts
 * listKeyset<NoteRow, "title" | "updatedAt">({ db, sql: "SELECT id, title, updated_at AS updatedAt FROM notes WHERE owner_id = ?", bindings: [ownerId], sortColumns: { title: "title", updatedAt: "updated_at" }, ...query });
 * ```
 */
export async function listKeyset<T extends { id: string }, S extends string>(options: KeysetListOptions<T, S>): Promise<Page<T>> {
  const ks = keyset({ column: options.sortColumns[options.sort], direction: options.direction, cursor: options.cursor, idColumn: options.idColumn });
  const hasWhere = /\bwhere\b/i.test(options.sql);
  const sql = `${options.sql}${ks.where ? ` ${hasWhere ? "AND" : "WHERE"} ${ks.where}` : ""} ORDER BY ${ks.orderBy} LIMIT ?`;
  const result = await options.db.prepare(sql).bind(...(options.bindings ?? []), ...ks.bindings, options.limit + 1).all<T>();
  const rows = options.map ? result.results.map(options.map) : result.results;
  const sortValue = options.sortValue ?? ((row: T) => (row as Record<string, unknown>)[options.sort] as string | number);
  return finishPage(rows, options.limit, ks.cursor, sortValue);
}

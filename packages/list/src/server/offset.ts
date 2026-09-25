/** Offset pagination for small admin lists that want a total. Prefer keyset for anything user-facing. */
import type { OffsetPage } from "../contracts/index";

export function offsetArgs(query: { page?: number; pageSize?: number }, maxPageSize = 100) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), maxPageSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function offsetPage<T>(items: T[], page: number, pageSize: number, total: number): OffsetPage<T> {
  return { items, page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

export type OffsetListOptions<T> = {
  db: D1Database;
  /** `SELECT ... FROM ... WHERE ...` without ORDER BY or LIMIT. */
  sql: string;
  /** `SELECT count(*) AS total FROM ... WHERE ...` with the same filters. */
  countSql: string;
  bindings?: (string | number | null)[];
  /** Full ORDER BY expression from an allowlist. */
  orderBy: string;
  page: number;
  pageSize: number;
  map?: (row: T) => T;
};

export async function listOffset<T>(options: OffsetListOptions<T>): Promise<OffsetPage<T>> {
  const bindings = options.bindings ?? [];
  const { page, pageSize, offset } = offsetArgs(options);
  const [countRow, result] = await Promise.all([
    options.db.prepare(options.countSql).bind(...bindings).first<{ total: number }>(),
    options.db.prepare(`${options.sql} ORDER BY ${options.orderBy} LIMIT ? OFFSET ?`).bind(...bindings, pageSize, offset).all<T>(),
  ]);
  const rows = options.map ? result.results.map(options.map) : result.results;
  return offsetPage(rows, page, pageSize, Number(countRow?.total ?? 0));
}

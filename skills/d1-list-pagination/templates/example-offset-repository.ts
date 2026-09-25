/** Offset list for a small admin table that wants a total. */
import { likeAny, likePattern } from "@softwareseva/core/server";
import { listOffset, type OffsetPage } from "@softwareseva/list/server";

export type UserRow = { id: string; email: string; createdAt: string };

export async function listUsers(db: D1Database, query: { q: string; page: number; pageSize: number }): Promise<OffsetPage<UserRow>> {
  const where = `WHERE ${likeAny(["email", "name"])}`;
  return listOffset<UserRow>({
    db,
    sql: `SELECT id, email, created_at AS createdAt FROM users ${where}`,
    countSql: `SELECT count(*) AS total FROM users ${where}`,
    bindings: [likePattern(query.q), likePattern(query.q)],
    orderBy: "created_at DESC, id DESC",
    page: query.page,
    pageSize: query.pageSize,
  });
}

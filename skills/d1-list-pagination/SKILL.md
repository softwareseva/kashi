---
name: d1-list-pagination
description: Add a paginated, searchable, sortable list endpoint on Cloudflare D1 with @kashi/list. Use when a route returns a collection (directory, admin table, feed, search results), when adding sort or search to an existing list, when choosing between keyset cursors and page numbers, or when a list query is slow and needs the right index.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@kashi/list@0.1 @kashi/core@0.1"
---

# Lists on D1

Default to **keyset** pagination: opaque `next`/`previous` cursors on `(sort_value, id)`. It is O(page) at any table size and stable while rows change. Use **offset** only for small admin lists (a few thousand rows) where a total count is worth an extra query.

## Endpoint recipe (keyset)

1. Migration: a composite index per allowlisted sort key, ending in `id` (`templates/migration.sql`). A filtered list puts the filter column first.
2. Route (`templates/example-route.ts`): parse the query string with `listQuerySchema(["updatedAt", "title"], { defaultDirection: "desc" })`. The array is the sort allowlist; anything else is a 422. Query params are `q`, `sort`, `direction`, `limit` (1 to 100, default 25) and `cursor`.
3. Repository (`templates/example-repository.ts`): call `listKeyset` with the base `SELECT ... WHERE <filters>` (no ORDER BY or LIMIT), the filter bindings, and a `sortColumns` map from sort key to SQL expression. Select the sort columns with `AS <sortKey>` aliases so the default `sortValue` works.
4. Search: `likeAny(["title", "body"])` in the WHERE and `likePattern(q)` bound once per column. This escapes `%` and `_`; never interpolate user text into SQL.
5. Respond with `ok(c, page)`. The shape is `{ data: { items, next, previous } }`.

## How the cursor works

`next` encodes the last row's sort value, id and direction; `previous` encodes the first row's. The next query adds `(col > ? OR (col = ? AND id > ?))` (flipped for `previous` and for `desc`) and fetches `limit + 1` rows to know whether another page exists. Cursors are base64url JSON, validated before they touch SQL; a tampered cursor is `422 INVALID_CURSOR`. Cursors are opaque to clients: never parse them in the UI, never store them past the session.

When any other parameter changes (search text, sort, direction, limit, filter), the client must drop the cursor. The `react-data-table` skill does this automatically.

## Composing SQL yourself

For joins or aggregates that `listKeyset` cannot express, use the pieces:

```ts
const ks = keyset({ column: sortColumns[sort], direction, cursor });
const sql = `SELECT ... FROM ... WHERE owner_id = ? ${ks.where ? `AND ${ks.where}` : ""} ORDER BY ${ks.orderBy} LIMIT ?`;
const rows = (await db.prepare(sql).bind(ownerId, ...ks.bindings, limit + 1).all<Row>()).results;
return finishPage(rows, limit, ks.cursor, (row) => row[sort]);
```

Sorting on an aggregate: wrap the aggregate query in a subquery so the alias is usable in WHERE.

## Offset variant

`offsetQuerySchema()` parses `q`, `page`, `pageSize`; `listOffset({ sql, countSql, bindings, orderBy, page, pageSize })` returns `{ items, page, pageSize, total, totalPages }`. `orderBy` must come from an allowlist. Cost grows with `page`, so cap `pageSize` at 100 and do not use it for user-facing feeds.

## Performance checklist

- Index matches the sort: `(sort_col, id)`, or `(filter_col, sort_col, id)` for a fixed filter.
- `LIKE '%x%'` cannot use an index; acceptable up to tens of thousands of rows. Beyond that add a prefix search (`likePattern(q, "prefix")`) or an FTS5 table.
- Never `SELECT *` into a list; select the columns the client shows.
- No `count(*)` on keyset lists. If the UI needs a total, expose a separate cached endpoint.

Design notes and index shapes: `references/design.md`.

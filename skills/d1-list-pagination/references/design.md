# Keyset pagination design

## Why not OFFSET

`LIMIT 25 OFFSET 10000` scans and discards 10,000 rows; D1 charges for rows read and latency climbs with page number. Inserts between requests shift rows so users see duplicates or gaps. Keyset uses the index to seek straight to the boundary row, so every page costs the same and the sequence is stable.

## Tie-break on id

Sort values repeat (same title, same second). `(sort_value, id)` makes the ordering total, so the predicate `(col > v OR (col = v AND id > i))` resumes exactly after the boundary row. The index must contain both columns in that order.

## Two-way cursors

Going backwards flips the comparison and the ORDER BY, then reverses the fetched rows so display order stays the same. `finishPage` computes:

- forward: `next` if more rows exist, `previous` if a cursor was used
- backward: `previous` if more rows exist, `next` always (the rows we came from)

## Index shapes

| Endpoint | Index |
|---|---|
| `/notes?sort=updatedAt` | `notes(updated_at, id)` |
| `/notes?sort=title` | `notes(title, id)` |
| `/users/:id/notes?sort=updatedAt` | `notes(owner_id, updated_at, id)` |
| soft-deleted rows excluded | partial index `... WHERE deleted_at IS NULL` |

Verify with `EXPLAIN QUERY PLAN` in `wrangler d1 execute --local --command`: expect `SEARCH ... USING INDEX`, not `SCAN`.

## Response shape

```json
{ "data": { "items": [...], "next": "eyJ2YWx1ZSI6...", "previous": null } }
```

Clients keep `q`, `sort`, `direction`, `limit` and `cursor` in the URL so a page is shareable and survives reload.

## Sort allowlist

`listQuerySchema(["updatedAt", "title"])` restricts `sort` at the boundary; `sortColumns` maps each key to a server-owned SQL expression. User input never becomes part of SQL text.

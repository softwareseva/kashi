# D1 migrations

- Directory: `migrations/` (or `migrations_dir` in `wrangler.jsonc`). Files `NNNN_name.sql`, four-digit zero-padded, applied in order by `wrangler d1 migrations apply <db> [--local|--remote]`.
- Package migrations are copied in by `npx kashi migrate` as `NNNN_<pkg>_<orig>.sql` and recorded in `kashi.lock.json`. Never rename them.
- Never edit an applied file. Fix forward with the next number.
- Every table: `id TEXT PRIMARY KEY`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT NULL` for soft delete. ISO-8601 UTC strings sort correctly.
- One composite index per sort key used by a list endpoint, ending in `id`: `CREATE INDEX t_col_id ON t(col, id)`. Filtered lists want the filter column first: `ON t(owner_id, col, id)`.
- Booleans are `INTEGER NOT NULL DEFAULT 0`; map to booleans in the repository.
- `ALTER TABLE` supports `ADD COLUMN`, `RENAME COLUMN`, `DROP COLUMN` (SQLite 3.35+). For type or constraint changes rebuild:

```sql
CREATE TABLE notes_new (...);
INSERT INTO notes_new SELECT ... FROM notes;
DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;
CREATE INDEX ...;
```

- Test both paths locally before shipping: apply to a database that already has data, and to an empty one.
- D1 binds at most 100 parameters per statement; chunk bulk inserts.
- Production migrations are an explicit step (`--remote`); CI can run them before deploy, see the `deploy-cloudflare` skill.

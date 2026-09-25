-- @kashi/sync: applied client operations (for idempotent replay) and the change log clients pull from.
CREATE TABLE IF NOT EXISTS sync_ops (
  op_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, op_id)
);
CREATE INDEX IF NOT EXISTS sync_ops_created ON sync_ops(created_at);

-- seq is assigned in commit order because D1 serialises writes per database.
CREATE TABLE IF NOT EXISTS sync_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_changes_scope_seq ON sync_changes(scope, seq);

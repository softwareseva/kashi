-- Example resource with the columns every synced, listable table carries.
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
-- One composite index per allowlisted sort key, ending in id for the keyset tie-break.
CREATE INDEX notes_title_id ON notes(title, id);
CREATE INDEX notes_updated_at_id ON notes(updated_at, id);

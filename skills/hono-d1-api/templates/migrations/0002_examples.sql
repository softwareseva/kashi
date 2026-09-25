-- Example table with the columns every kashi table carries (0001 is the copied @kashi/core rate_limits migration).
CREATE TABLE examples (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX examples_updated_at_id ON examples(updated_at, id);

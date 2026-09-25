-- One composite index per allowlisted sort key, ending in id for the keyset tie-break.
CREATE INDEX notes_updated_at_id ON notes(updated_at, id);
CREATE INDEX notes_title_id ON notes(title, id);
-- Filtered list: filter column first.
-- CREATE INDEX notes_owner_updated_at_id ON notes(owner_id, updated_at, id);

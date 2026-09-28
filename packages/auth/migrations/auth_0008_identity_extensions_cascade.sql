-- @softwareseva/auth: rebuild the auth_0007 tables that reference auth_users with ON DELETE CASCADE,
-- so deleting a user also removes their recovery codes, peer sessions and contact aliases.
-- The CREATE IF NOT EXISTS lines make this safe where auth_0007 was never applied.
CREATE TABLE IF NOT EXISTS auth_bound_otp (
  id TEXT PRIMARY KEY, channel TEXT NOT NULL, purpose TEXT NOT NULL, destination TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '', code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_bound_otp_lookup ON auth_bound_otp(channel, purpose, destination, user_id, created_at);

CREATE TABLE IF NOT EXISTS auth_recovery_codes (code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL);
DROP TABLE IF EXISTS auth_recovery_codes_new;
CREATE TABLE auth_recovery_codes_new (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO auth_recovery_codes_new (code_hash, user_id, consumed_at, created_at)
  SELECT code_hash, user_id, consumed_at, created_at FROM auth_recovery_codes WHERE user_id IN (SELECT id FROM auth_users);
DROP TABLE auth_recovery_codes;
ALTER TABLE auth_recovery_codes_new RENAME TO auth_recovery_codes;
CREATE INDEX IF NOT EXISTS auth_recovery_codes_user ON auth_recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS auth_peer_sessions (family_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject TEXT NOT NULL, central_session_id TEXT NOT NULL);
DROP TABLE IF EXISTS auth_peer_sessions_new;
CREATE TABLE auth_peer_sessions_new (
  family_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  central_session_id TEXT NOT NULL
);
INSERT INTO auth_peer_sessions_new (family_id, user_id, subject, central_session_id)
  SELECT family_id, user_id, subject, central_session_id FROM auth_peer_sessions WHERE user_id IN (SELECT id FROM auth_users);
DROP TABLE auth_peer_sessions;
ALTER TABLE auth_peer_sessions_new RENAME TO auth_peer_sessions;
CREATE INDEX IF NOT EXISTS auth_peer_sessions_user ON auth_peer_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_peer_sessions_subject ON auth_peer_sessions(subject);

CREATE TABLE IF NOT EXISTS auth_contact_aliases (channel TEXT NOT NULL, destination TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(channel, destination));
DROP TABLE IF EXISTS auth_contact_aliases_new;
CREATE TABLE auth_contact_aliases_new (
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  PRIMARY KEY(channel, destination)
);
INSERT INTO auth_contact_aliases_new (channel, destination, user_id)
  SELECT channel, destination, user_id FROM auth_contact_aliases WHERE user_id IN (SELECT id FROM auth_users);
DROP TABLE auth_contact_aliases;
ALTER TABLE auth_contact_aliases_new RENAME TO auth_contact_aliases;
CREATE INDEX IF NOT EXISTS auth_contact_aliases_user ON auth_contact_aliases(user_id);

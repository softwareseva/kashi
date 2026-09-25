-- @softwareseva/auth: users, external identities and rotating refresh sessions.
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  roles TEXT NOT NULL DEFAULT '[]',
  email_verified_at TEXT,
  phone_verified_at TEXT,
  password_hash TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email ON auth_users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_phone ON auth_users(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(provider, subject)
);
CREATE INDEX IF NOT EXISTS auth_identities_user ON auth_identities(user_id);

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT,
  expires_at TEXT NOT NULL,
  rotated_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_refresh_family ON auth_refresh_sessions(family_id, revoked_at);
CREATE INDEX IF NOT EXISTS auth_refresh_user ON auth_refresh_sessions(user_id, revoked_at);

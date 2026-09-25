-- @softwareseva/auth: one-time codes, WebAuthn credentials and challenges.
CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_otp_destination ON auth_otp_codes(destination, consumed_at, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_name TEXT NOT NULL,
  backed_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS auth_passkeys_user ON auth_passkeys(user_id);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry ON auth_challenges(expires_at);

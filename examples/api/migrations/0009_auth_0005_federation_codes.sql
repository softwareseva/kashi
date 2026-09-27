-- @softwareseva/auth: single-use authorization codes for peer federation (issuer side only).
CREATE TABLE IF NOT EXISTS auth_federation_codes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_federation_codes_expires ON auth_federation_codes(expires_at);

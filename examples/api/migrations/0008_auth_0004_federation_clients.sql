-- @softwareseva/auth: peer sites registered to sign their users in here (issuer side only).
CREATE TABLE IF NOT EXISTS auth_federation_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT,
  site_name TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS auth_federation_clients_status ON auth_federation_clients(status);

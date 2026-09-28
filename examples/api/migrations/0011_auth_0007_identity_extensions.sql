-- Opt-in identity extensions: purpose-bound OTP, hashed recovery codes, contact aliases and
-- federation session associations. Only used when `identityExtensions`/`otpChannels` are enabled.
CREATE TABLE auth_bound_otp (
 id TEXT PRIMARY KEY, channel TEXT NOT NULL, purpose TEXT NOT NULL, destination TEXT NOT NULL,
 user_id TEXT NOT NULL DEFAULT '', code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX auth_bound_otp_lookup ON auth_bound_otp(channel, purpose, destination, user_id, created_at);

CREATE TABLE auth_recovery_codes (
 code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id),
 consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX auth_recovery_codes_user ON auth_recovery_codes(user_id);

CREATE TABLE auth_peer_sessions (
 family_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id),
 subject TEXT NOT NULL, central_session_id TEXT NOT NULL
);
CREATE INDEX auth_peer_sessions_user ON auth_peer_sessions(user_id);
CREATE INDEX auth_peer_sessions_subject ON auth_peer_sessions(subject);

CREATE TABLE auth_contact_aliases (
 channel TEXT NOT NULL, destination TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES auth_users(id),
 PRIMARY KEY(channel, destination)
);

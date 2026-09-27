-- @softwareseva/auth: record which RP ID (domain) each passkey was created for.
ALTER TABLE auth_passkeys ADD COLUMN rp_id TEXT;

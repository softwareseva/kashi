-- @softwareseva/auth: track when a federation client's secret was last approved/rotated.
ALTER TABLE auth_federation_clients ADD COLUMN secret_rotated_at TEXT;

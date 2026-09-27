---
"@softwareseva/auth": minor
---

Peer federation: issuer admins can now rotate a registered client's secret without deleting and re-registering it.

- `POST /v1/auth/federation/clients/:id/rotate` (role `admin`) mints a new `clientSecret` for an already-approved client, shown once, same as the initial approval. The client's `clientId` and `redirectUri` are unchanged — only the secret's hash is replaced, so the old secret stops working immediately (no overlap window).
- `GET /v1/auth/federation/clients` now reports `secretRotatedAt` per client.
- New migration `auth_0006_federation_client_secret_rotated_at.sql` (additive `ALTER TABLE`).

See the "Rotating a compromised or expiring secret" section of the `auth-federation` skill.

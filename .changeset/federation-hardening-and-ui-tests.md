---
"@softwareseva/auth": minor
---

Peer federation hardening, plus two bug fixes surfaced by finally exercising the consumer flow end-to-end against a real issuer instead of only mocked responses:

- **Fix:** the consumer's `exchangePeerCode` and JWKS fetch expected a flat response body, but the real `/federation/token` and `/federation/.well-known/jwks.json` endpoints wrap their payload in the standard `{ data }` envelope — peer sign-in never actually worked end-to-end until now.
- **Fix:** `AuthStore.userByIdentity` had an unqualified `id` column in its join against `auth_identities`, which SQLite rejects as ambiguous. This broke returning-user sign-in for *every* identity provider (Google, Apple, Facebook, peer federation), not just federation.
- `POST /v1/auth/federation/clients/:id/revoke` (role `admin`): stops trust in a previously approved client immediately — both `/federation/authorize` and `/federation/token` gate on `status = 'approved'`, so a revoked client can no longer start a new authorization or exchange a code, even one issued moments earlier. Unlike rotate, there is no new secret to hand back.
- The federation client-secret comparison now uses the existing constant-time `safeEqual` helper instead of `!==`.
- JWKS key selection now fails closed on an unknown `kid` instead of silently falling back to the first published key, so a key-rotation window with multiple published keys is verified correctly rather than by accident.

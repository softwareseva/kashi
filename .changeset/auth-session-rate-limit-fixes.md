---
"@softwareseva/auth": patch
---

Refresh-token reuse now has a grace window: a token rotated within the last `refreshReuseGraceSeconds` (default 30) is accepted again and gets a sibling pair on the same family, so two browser tabs refreshing at once no longer revoke the session everywhere. Reuse after the window still revokes the family with `TOKEN_REUSE`. `rotateRefreshToken` now takes `(config, env, raw)`.

Anonymous passkey sign-up (`/passkeys/signup/options` and `/verify`) is rate limited per IP (20 calls per 10 minutes, shared across both).

New migration `auth_0008_identity_extensions_cascade.sql` rebuilds `auth_recovery_codes`, `auth_peer_sessions` and `auth_contact_aliases` with `ON DELETE CASCADE` to `auth_users`, so deleting a user no longer fails on those rows. Run `npx @softwareseva/cli migrate` and apply it.

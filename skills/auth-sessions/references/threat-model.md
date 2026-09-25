# Session threat model

| Threat | Mitigation |
|---|---|
| Stolen access token | 15-minute lifetime; user row re-checked per request so disabling a user is immediate |
| Stolen refresh token used by attacker first | Victim's next refresh presents a rotated token -> family revoked, both parties signed out |
| Stolen refresh token used by victim first | Attacker's copy is already rotated -> family revoked on use |
| Database leak | Refresh tokens and OTP codes stored as hashes (SHA-256 / peppered HMAC); passwords PBKDF2 with per-user salt |
| CSRF against cookie sessions | `SameSite=Lax` cookies plus Origin / Sec-Fetch-Site check on every non-GET request authenticated by cookie |
| XSS exfiltrating long-lived credentials | HttpOnly cookies; cookie sessions cannot be exchanged for bearer tokens |
| Account enumeration | Password and OTP endpoints answer identically for unknown accounts; password verification always runs a hash |
| Brute force | D1 rate limits per IP and per identifier on password, OTP request and OTP verify; 5 attempts per code |
| Open redirect after OAuth | `next` accepts only relative paths without a scheme or `//` |
| JWT algorithm confusion | Verification pins `HS256` and checks `iss` and `aud` |

Rotation of `JWT_SECRET` invalidates every access token (users refresh transparently, refresh tokens are unaffected because they are opaque). To end all sessions, also revoke every refresh session.

Cookie names use the `__Host-` prefix in production, which requires `Secure`, `Path=/` and no `Domain`. For a web app on a different subdomain than the API, serve the API under the same site or proxy `/v1` through the web origin.

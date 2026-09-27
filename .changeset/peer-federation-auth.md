---
"@softwareseva/auth": minor
---

Cross-site sign-in: a user created on one kashi site can now sign in on another, with each site's admin approving the relationship independently.

- **New provider, `providers.peer`**: a site can act as an OIDC-style **issuer** (`peer.issuer.enabled`), letting other kashi sites' users sign in there, and/or a **consumer** (`peer.trust`), accepting sign-ins from peers it trusts. No shared database or `JWT_SECRET` between sites — the issuer signs short-lived ID tokens with a dedicated RS256 keypair (`FEDERATION_PRIVATE_KEY`, published at `GET /v1/auth/federation/.well-known/jwks.json`), and the consumer auto-provisions its own local user on first sign-in through the existing `auth_identities` table (`provider: "kashi"`), exactly like Google/Apple/Facebook.
- **Double opt-in, no live handshake**: a consumer registers with `POST /federation/clients/register`; the issuer's admin approves with `POST /federation/clients/:id/approve` (role `admin`), which mints a `clientSecret` shown once; the consumer's admin then adds it to their own `providers.peer.trust` config. Both sides act independently — the same shape as registering any external OAuth app.
- **Web and native**: `GET /peer/:key/start` → `GET /peer/callback` mirrors the existing Google/Apple/Facebook web redirect flow; `POST /peer/token` lets a native app (via its own in-app-browser adapter) complete the exchange without the `clientSecret` ever leaving the backend.
- Authorization codes are single-use, DB-backed (`auth_federation_codes`) and expire in 60 seconds.
- React: `<PeerSignInButton />`, `usePeerUrl()`, and `<SignIn />` now renders a "Continue with {label}" button per trusted peer automatically.
- Flutter (`kashi_auth`): `AuthProviders.peers`, `KashiAuthApi.peerAuthorizeUrl`/`peerToken`, the `PeerBrowserSignIn` adapter seam, and `KSignIn(peerBrowser: ...)`.

New migrations: `auth_0004_federation_clients.sql` (issuer-side client registry) and `auth_0005_federation_codes.sql` (single-use authorization codes). See the new `auth-federation` skill.

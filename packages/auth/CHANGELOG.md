# @softwareseva/auth

## 1.4.0

### Minor Changes

- 4d0ca61: Add `renderOtpEmail({ code, purpose, ttlSeconds, brand })` from `@softwareseva/auth/server`: a ready-made, responsive, table-based HTML + plain-text template for one-time-code emails, with distinct wording for `"sign-in"` and `"link"` purposes, escaped dynamic content, no remote images, and optional brand name/colors. `renderOtpEmail` only formats the message — it never sends anything.
  
  The `otp` provider's `send` callback now receives a fifth argument, `{ purpose, ttlSeconds }` (using the configured `ttlSeconds`, default 300), so senders can pass it straight into `renderOtpEmail`. Existing four-argument `send` implementations remain valid and keep working unchanged.

### Patch Changes

- @softwareseva/core@1.4.0
  - @softwareseva/ui@1.4.0

## 1.3.0

### Minor Changes

- 611c10b: Peer federation hardening, plus two bug fixes surfaced by finally exercising the consumer flow end-to-end against a real issuer instead of only mocked responses:
  
  - **Fix:** the consumer's `exchangePeerCode` and JWKS fetch expected a flat response body, but the real `/federation/token` and `/federation/.well-known/jwks.json` endpoints wrap their payload in the standard `{ data }` envelope — peer sign-in never actually worked end-to-end until now.
  - **Fix:** `AuthStore.userByIdentity` had an unqualified `id` column in its join against `auth_identities`, which SQLite rejects as ambiguous. This broke returning-user sign-in for *every* identity provider (Google, Apple, Facebook, peer federation), not just federation.
  - `POST /v1/auth/federation/clients/:id/revoke` (role `admin`): stops trust in a previously approved client immediately — both `/federation/authorize` and `/federation/token` gate on `status = 'approved'`, so a revoked client can no longer start a new authorization or exchange a code, even one issued moments earlier. Unlike rotate, there is no new secret to hand back.
  - The federation client-secret comparison now uses the existing constant-time `safeEqual` helper instead of `!==`.
  - JWKS key selection now fails closed on an unknown `kid` instead of silently falling back to the first published key, so a key-rotation window with multiple published keys is verified correctly rather than by accident.

### Patch Changes

- @softwareseva/core@1.3.0
  - @softwareseva/ui@1.3.0

## 1.2.0

### Minor Changes

- 0afc4eb: Peer federation: issuer admins can now rotate a registered client's secret without deleting and re-registering it.
  
  - `POST /v1/auth/federation/clients/:id/rotate` (role `admin`) mints a new `clientSecret` for an already-approved client, shown once, same as the initial approval. The client's `clientId` and `redirectUri` are unchanged — only the secret's hash is replaced, so the old secret stops working immediately (no overlap window).
  - `GET /v1/auth/federation/clients` now reports `secretRotatedAt` per client.
  - New migration `auth_0006_federation_client_secret_rotated_at.sql` (additive `ALTER TABLE`).
  
  See the "Rotating a compromised or expiring secret" section of the `auth-federation` skill.
- 6ceefc8: Cross-site sign-in: a user created on one kashi site can now sign in on another, with each site's admin approving the relationship independently.
  
  - **New provider, `providers.peer`**: a site can act as an OIDC-style **issuer** (`peer.issuer.enabled`), letting other kashi sites' users sign in there, and/or a **consumer** (`peer.trust`), accepting sign-ins from peers it trusts. No shared database or `JWT_SECRET` between sites — the issuer signs short-lived ID tokens with a dedicated RS256 keypair (`FEDERATION_PRIVATE_KEY`, published at `GET /v1/auth/federation/.well-known/jwks.json`), and the consumer auto-provisions its own local user on first sign-in through the existing `auth_identities` table (`provider: "kashi"`), exactly like Google/Apple/Facebook.
  - **Double opt-in, no live handshake**: a consumer registers with `POST /federation/clients/register`; the issuer's admin approves with `POST /federation/clients/:id/approve` (role `admin`), which mints a `clientSecret` shown once; the consumer's admin then adds it to their own `providers.peer.trust` config. Both sides act independently — the same shape as registering any external OAuth app.
  - **Web and native**: `GET /peer/:key/start` → `GET /peer/callback` mirrors the existing Google/Apple/Facebook web redirect flow; `POST /peer/token` lets a native app (via its own in-app-browser adapter) complete the exchange without the `clientSecret` ever leaving the backend.
  - Authorization codes are single-use, DB-backed (`auth_federation_codes`) and expire in 60 seconds.
  - React: `<PeerSignInButton />`, `usePeerUrl()`, and `<SignIn />` now renders a "Continue with {label}" button per trusted peer automatically.
  - Flutter (`kashi_auth`): `AuthProviders.peers`, `KashiAuthApi.peerAuthorizeUrl`/`peerToken`, the `PeerBrowserSignIn` adapter seam, and `KSignIn(peerBrowser: ...)`.
  
  New migrations: `auth_0004_federation_clients.sql` (issuer-side client registry) and `auth_0005_federation_codes.sql` (single-use authorization codes). See the new `auth-federation` skill.

### Patch Changes

- @softwareseva/core@1.2.0
  - @softwareseva/ui@1.2.0

## 1.1.0

### Minor Changes

- 0e82b44: Passkeys become the default, anonymous entry point.
  
  - **Contact-free sign-up**: `POST /passkeys/signup/options` / `verify` create a brand-new account with no email, phone or OAuth grant — the passkey is verified first, and the account (plus its passkey) is written only after that succeeds, in one atomic write. `AuthStore.createUserWithPasskey` never leaves an orphaned user or an unattached credential. Disable with `providers.passkeys.allowSignUp = false`.
  - **Facebook Login**: a new provider (`providers.facebook`) mirroring Google/Apple — web authorization-code flow and native access-token verification via the Graph API.
  - **`requireVerified`**: a new middleware (alongside `requireRole`) for gating specific actions behind a "valid id" — an OTP-verified email/phone, or a linked Google/Apple/Facebook identity — without requiring one for sign-in itself. `isVerifiedIdentity(user)` is the underlying check.
  - Passkeys now record the `rpId` (domain) they were created for; `GET /passkeys` returns it so a "manage passkeys" screen can show which domain each key is tied to.
  - React: `<PasskeySignUpButton />` and `usePasskeySignUp()`; `<SignIn />` now shows passkeys first (sign-in, then contact-free sign-up) with OTP/OAuth offered as the way to attach a valid id, not as the primary way in. `<OAuthButton />` and `useOAuthUrl` accept `"facebook"`.
  
  Migration `auth_0003_passkey_domain.sql` adds `auth_passkeys.rp_id` (nullable, backward compatible).

### Patch Changes

- @softwareseva/core@1.1.0
  - @softwareseva/ui@1.1.0

## 1.0.0

### Major Changes

- 77873b4: Rework the React-facing surface onto TanStack libraries.

  - `@softwareseva/core` gains a `./react` subpath (`useApiQuery`, `useApiMutation`, `createQueryClient`) — a thin TanStack Query binding that types errors as `ApiError`.
  - `@softwareseva/list`'s `DataTable` now renders through TanStack Table internally (same `columns`/`sort`/`direction`/`onSort` props); adds `createListQuery` to build a directory's URL state + keyset fetch as one hook.
  - `@softwareseva/auth`'s `AuthProvider`/`useAuth` and sign-in hooks (`usePasswordSignIn`, `useOtp`, `usePasskeySignIn`, `usePasskeyRegister`) are now backed by TanStack Query instead of local component state; `AuthProvider` must be mounted inside a `QueryClientProvider`. `PasswordSignIn`/`OtpSignIn` now use `@softwareseva/ui`'s `useAppForm`.
  - `@softwareseva/ui` adds TanStack Form field bindings (`useAppForm`, `TextField`, `CheckboxField`, `SelectField`, `RadioGroupField`) alongside the existing uncontrolled `Field`.

  Breaking: `DataTable`'s `sort` prop is now typed as the column key type instead of `string`; `AuthProvider` requires a `QueryClientProvider` ancestor; `@softwareseva/ui` now requires `@tanstack/react-form` as a peer dependency.

### Patch Changes

- Updated dependencies [77873b4]
  - @softwareseva/core@1.0.0
  - @softwareseva/ui@1.0.0

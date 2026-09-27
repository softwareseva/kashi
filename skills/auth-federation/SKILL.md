---
name: auth-federation
description: Cross-site single sign-on between kashi sites with @softwareseva/auth — let a user created on one site (e.g. auth.example.com) sign in on another (e.g. app.example.com, or a totally different domain), with each site's admin approving the relationship independently. Use when asked to share or confederate accounts across sites, add "Sign in with {other site}", or act as an identity provider for another deployment.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/auth@1.2"
---

# Cross-site sign-in (peer federation)

Every kashi site keeps its own independent D1 database, `JWT_SECRET` and `auth_users` table — nothing is ever shared between sites. Peer federation lets one site (the **issuer**) act as an OIDC-style identity provider that another site (the **consumer**) adds as a fourth sign-in method, next to Google/Apple/Facebook. On first sign-in the consumer auto-provisions its own local user, linked to the issuer's account through `auth_identities(provider='kashi', subject='{issuer}|{remoteUserId}')` — the same table Google and Apple already use. No shared secret, no shared DB, and it works identically whether the two sites share a domain (`auth.vvmvp.in` ↔ `marketing.vvmvp.in`) or not (`auth.vvmvp.in` ↔ `fwd.vdst.in`).

## Roles

A site can be an issuer, a consumer, or both — both are opt-in:

```ts
providers: {
  peer: {
    issuer: { enabled: true }, // this site lets other kashi sites sign their users in here
    trust: [                   // this site accepts sign-ins from these peers
      { issuer: "https://auth.vvmvp.in/v1/auth", clientId: "...", clientSecret: "...", label: "vvmvp" },
    ],
  },
}
```

## Double opt-in: no live handshake, just two admin actions

1. **Consumer registers.** `POST {issuer}/v1/auth/federation/clients/register` with `{ siteName, redirectUri }` where `redirectUri` is `${CONSUMER_AUTH_URL}/peer/callback`. Creates a `pending` row and returns a `clientId`.
2. **Issuer approves.** An admin on the issuer calls `POST {issuer}/v1/auth/federation/clients/:id/approve` (needs the `admin` role — wrap it behind your own admin UI or a one-off authenticated script). The response includes a `clientSecret`, shown exactly once; only its hash is stored.
3. **Consumer trusts.** The consumer's admin adds the issued `clientId`/`clientSecret` to its own `providers.peer.trust` config and deploys. That deploy is the consumer admin's half of the approval — nothing calls the issuer until it happens.

Both sides are independent, ordinary OAuth-app registration — the same shape as creating a Google OAuth client, just against another kashi site instead of Google.

## Issuer setup

1. Generate a dedicated RS256 keypair — **never reuse `JWT_SECRET`** for this:
   ```ts
   import { generateFederationKeypair } from "@softwareseva/auth/server";
   const { privateJwk } = await generateFederationKeypair();
   // wrangler secret put FEDERATION_PRIVATE_KEY   (paste JSON.stringify(privateJwk))
   ```
2. Enable `providers.peer.issuer.enabled = true`. The public half of the key is derived on every request and served at `GET /v1/auth/federation/.well-known/jwks.json` — nothing else to publish.
3. Approve registrations as they come in (step 2 above). Revoke a client by updating its `auth_federation_clients.status` row directly (`revoked`); there is no unapprove endpoint on purpose — reads-only clients should not be able to disable themselves.

ID tokens are minted for **5 minutes** and carry `iss` (this site's `AUTH_URL`), `aud` (the consumer's `clientId`), `sub` (this site's local user id), `email`/`email_verified`/`name`. They never touch `JWT_SECRET`.

### Rotating a compromised or expiring secret

`POST {issuer}/v1/auth/federation/clients/:id/approve` shows the `clientSecret` exactly once — if it leaks, or you just rotate secrets on a schedule, an admin calls `POST {issuer}/v1/auth/federation/clients/:id/rotate` (also `admin`-gated) to mint a new one for that same client. This keeps the client's `clientId` and `redirectUri` unchanged, so the consumer never has to re-register — only update its stored secret.

Rotation is **immediate**: the old secret stops validating the instant the new one is issued (there is no overlap window), so line up the consumer admin's config update right after rotating — the same manual handoff as the initial approval, just repeated. `GET /v1/auth/federation/clients` reports `secretRotatedAt` per client so you can see how long a secret has been live. Rotating a client that was never approved (still `pending`) or has been `revoked` returns 404.

## Consumer setup

1. Register with each issuer (step 1 above) and get the relationship approved.
2. Add the issued credentials to `providers.peer.trust`.
3. `GET /v1/auth/config` now reports `peer: [{ key, label }]` — one per trusted issuer. The React `<SignIn />` card and Flutter `KSignIn` both render a "Continue with {label}" button automatically once you pass an adapter (Flutter needs a `PeerBrowserSignIn`; React needs nothing extra, it's a plain link).
4. On success, `userForIdentity` runs exactly as it does for Google/Apple: link by `auth_identities`, else link by verified email, else create a new local user (set `allowSignUp: false` on a trust entry to only admit existing users).

## Web vs. native

- **Web**: `GET /v1/auth/peer/:key/start?next=` redirects to the issuer, which redirects back to `GET /v1/auth/peer/callback` — cookies are set and the browser lands on `APP_ORIGIN + next`, identical to the Google/Apple/Facebook web flow.
- **Native (Flutter)**: there is no SDK for another kashi site, so the app opens `KashiAuthApi.peerAuthorizeUrl(peerKey)` in a system browser via your own `PeerBrowserSignIn` adapter (e.g. `flutter_web_auth_2`, or `ASWebAuthenticationSession`/Custom Tabs directly) and watches for `KashiAuthApi.peerRedirectPrefix()` — the same `/peer/callback` URL as web, reached over a universal/app link so the OS hands control back to the app instead of loading the page. The app extracts `code` from the returned URL and calls `KashiAuthApi.peerToken(peerKey, code)`, which exchanges it server-side — the `clientSecret` never ships in the app.

## Security notes

- The federation signing key is separate from `JWT_SECRET` specifically so a leaked federation key can't be used to mint this site's own session tokens, and vice versa.
- Authorization codes are single-use, expire in 60 seconds, and are bound to the exact `clientId` + `redirectUri` they were issued for.
- `/federation/clients/register` is public (any site can ask) but rate-limited (10/hour/IP) and does nothing until an admin approves it — registering is not the same as being trusted.
- Treat a peer's federation `clientSecret` like any other OAuth client secret: a Worker secret (`wrangler secret put`), never a var, never committed.

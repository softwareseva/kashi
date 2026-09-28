import { env, SELF } from "cloudflare:test";
import { hashPassword, sha256Hex } from "@softwareseva/core/server";
import { describe, expect, it } from "vitest";

type Json = { data?: any; code?: string };
const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const res = await SELF.fetch(`http://example.com/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
  return { res, status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

// This example self-federates (see auth.ts): the consumer half calls `exchangePeerCode`, which does
// a real `fetch()` to AUTH_URL ("http://example.com/v1/auth"). That fetch would otherwise leave the
// worker-under-test and hit the real network, so route calls to that origin back into this same
// worker via SELF.fetch; anything else passes through untouched.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
  return url.startsWith("http://example.com/") ? SELF.fetch(url, init) : nativeFetch(input as never, init);
}) as typeof fetch;

async function signInAs(id: string, admin = false) {
  await env.DB.prepare("INSERT INTO auth_users(id, display_name, email, roles, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '2026-01-01', '2026-01-01')")
    .bind(id, id, `${id}@example.com`, JSON.stringify(admin ? ["user", "admin"] : ["user"]), await hashPassword("correct horse battery")).run();
  const signIn = await call("/auth/password/sign-in", { method: "POST", json: { identifier: `${id}@example.com`, password: "correct horse battery", transport: "token" } });
  return signIn.body.data.accessToken as string;
}

describe("peer federation: issuer side", () => {
  it("registers, approves and mints an ID token verifiable against this site's own JWKS", async () => {
    // 1. A consumer site registers itself as a client (public, no auth required).
    const register = await call("/auth/federation/clients/register", { method: "POST", json: { siteName: "marketing.example.com", redirectUri: "https://marketing.example.com/v1/auth/peer/callback" } });
    expect(register.status).toBe(201);
    const clientId = register.body.data.clientId as string;
    const registrationId = register.body.data.id as string;
    expect(register.body.data.status).toBe("pending");

    // 2. Anyone who isn't an admin is refused approval.
    const plainToken = await signInAs("usr_plain_fed");
    expect((await call(`/auth/federation/clients/${registrationId}/approve`, { method: "POST", headers: { Authorization: `Bearer ${plainToken}` } })).status).toBe(403);

    // 3. An admin approves it and gets the client secret exactly once.
    const adminToken = await signInAs("usr_admin_fed", true);
    const approve = await call(`/auth/federation/clients/${registrationId}/approve`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } });
    expect(approve.status).toBe(200);
    const clientSecret = approve.body.data.clientSecret as string;
    expect(clientSecret.length).toBeGreaterThan(20);

    // 4. A signed-in user authorizes that client and is redirected back with a one-time code.
    const userToken = await signInAs("usr_holder_fed");
    const redirectUri = "https://marketing.example.com/v1/auth/peer/callback";
    const authorize = await call(`/auth/federation/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz`, { headers: { Authorization: `Bearer ${userToken}` } });
    expect(authorize.status).toBe(302);
    const location = new URL(authorize.res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe(redirectUri);
    expect(location.searchParams.get("state")).toBe("xyz");
    const code = location.searchParams.get("code")!;
    expect(code).toBeTruthy();

    // 5. The consumer exchanges the code (with its client secret) for an ID token.
    const token = await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code, clientId, clientSecret, redirectUri } });
    expect(token.status).toBe(200);
    const idToken = token.body.data.idToken as string;
    const [headerB64, payloadB64] = idToken.split(".");
    expect(JSON.parse(Buffer.from(headerB64, "base64url").toString()).alg).toBe("RS256");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload).toMatchObject({ aud: clientId, sub: "usr_holder_fed" });
    expect(payload.iss).toBe("http://example.com/v1/auth");
    // hooks.federationClaims (see src/auth.ts) merges app-specific claims into the ID token.
    expect(payload.example).toBe(clientId);

    // 6. A stolen or reused code is rejected.
    expect((await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code, clientId, clientSecret, redirectUri } })).body.code).toBe("INVALID_GRANT");

    // 7. This site's public key is published so the consumer can verify the ID token itself.
    const jwks = await call("/auth/federation/.well-known/jwks.json");
    expect(jwks.status).toBe(200);
    expect(jwks.body.data.keys).toHaveLength(1);
    expect(jwks.body.data.keys[0]).not.toHaveProperty("d");
  });

  it("rejects a client that was never approved", async () => {
    const res = await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code: "whatever-a-plausible-length-code", clientId: "unknown-client", clientSecret: "x", redirectUri: "https://x.example.com/cb" } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CLIENT");
  });

  it("rotates a client's secret: the old one stops working immediately, the new one works", async () => {
    const register = await call("/auth/federation/clients/register", { method: "POST", json: { siteName: "rotating.example.com", redirectUri: "https://rotating.example.com/v1/auth/peer/callback" } });
    const registrationId = register.body.data.id as string;
    const clientId = register.body.data.clientId as string;
    const redirectUri = "https://rotating.example.com/v1/auth/peer/callback";

    // A never-approved (pending) client can't be rotated.
    const adminToken = await signInAs("usr_admin_rotate", true);
    expect((await call(`/auth/federation/clients/${registrationId}/rotate`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } })).status).toBe(404);

    const approve = await call(`/auth/federation/clients/${registrationId}/approve`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } });
    const oldSecret = approve.body.data.clientSecret as string;

    // Only an admin can rotate.
    const plainToken = await signInAs("usr_plain_rotate");
    expect((await call(`/auth/federation/clients/${registrationId}/rotate`, { method: "POST", headers: { Authorization: `Bearer ${plainToken}` } })).status).toBe(403);

    const rotate = await call(`/auth/federation/clients/${registrationId}/rotate`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } });
    expect(rotate.status).toBe(200);
    const newSecret = rotate.body.data.clientSecret as string;
    expect(newSecret).not.toBe(oldSecret);

    const userToken = await signInAs("usr_holder_rotate");
    const mintCode = async () => {
      const authorize = await call(`/auth/federation/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz`, { headers: { Authorization: `Bearer ${userToken}` } });
      return new URL(authorize.res.headers.get("Location")!).searchParams.get("code")!;
    };

    // The old secret is rejected immediately after rotation.
    const withOldSecret = await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code: await mintCode(), clientId, clientSecret: oldSecret, redirectUri } });
    expect(withOldSecret.status).toBe(401);
    expect(withOldSecret.body.code).toBe("INVALID_CLIENT");

    // The new secret works.
    const withNewSecret = await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code: await mintCode(), clientId, clientSecret: newSecret, redirectUri } });
    expect(withNewSecret.status).toBe(200);
    expect(withNewSecret.body.data.idToken).toBeTruthy();
  });

  it("revokes an approved client: authorize and token exchange both stop working, and a pending registration cannot be revoked", async () => {
    const register = await call("/auth/federation/clients/register", { method: "POST", json: { siteName: "revoking.example.com", redirectUri: "https://revoking.example.com/v1/auth/peer/callback" } });
    const registrationId = register.body.data.id as string;
    const clientId = register.body.data.clientId as string;
    const redirectUri = "https://revoking.example.com/v1/auth/peer/callback";

    const adminToken = await signInAs("usr_admin_revoke", true);
    expect((await call(`/auth/federation/clients/${registrationId}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } })).status).toBe(404); // still pending

    const approve = await call(`/auth/federation/clients/${registrationId}/approve`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } });
    const clientSecret = approve.body.data.clientSecret as string;

    const userToken = await signInAs("usr_holder_revoke");
    const authorizeBeforeRevoke = await call(`/auth/federation/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz`, { headers: { Authorization: `Bearer ${userToken}` } });
    const codeBeforeRevoke = new URL(authorizeBeforeRevoke.res.headers.get("Location")!).searchParams.get("code")!;

    // Only an admin can revoke.
    const plainToken = await signInAs("usr_plain_revoke");
    expect((await call(`/auth/federation/clients/${registrationId}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${plainToken}` } })).status).toBe(403);

    const revoke = await call(`/auth/federation/clients/${registrationId}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } });
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.status).toBe("revoked");

    // A code issued moments before revocation no longer exchanges.
    const tokenAfterRevoke = await call("/auth/federation/token", { method: "POST", json: { grant_type: "authorization_code", code: codeBeforeRevoke, clientId, clientSecret, redirectUri } });
    expect(tokenAfterRevoke.status).toBe(401);
    expect(tokenAfterRevoke.body.code).toBe("INVALID_CLIENT");

    // The client can no longer be granted a new authorization code either.
    const authorizeAfterRevoke = await call(`/auth/federation/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz`, { headers: { Authorization: `Bearer ${userToken}` } });
    expect(authorizeAfterRevoke.status).toBe(400);
    expect(authorizeAfterRevoke.body.code).toBe("INVALID_CLIENT");

    // Revoking again (already revoked, not 'approved') is a no-op 404, mirroring rotate's behavior.
    expect((await call(`/auth/federation/clients/${registrationId}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` } })).status).toBe(404);
  });
});

/** Approves the given self-trust clientId directly in the DB (the "issuer half" of this site trusting itself), so the consumer half's authorize/token/callback endpoints have something real to exchange against. Idempotent: several tests in this file share one D1 instance and each seed the same clientId. */
async function seedApprovedSelfTrustClient(clientId: string, clientSecret: string) {
  await env.DB.prepare(
    "INSERT INTO auth_federation_clients(id, client_id, client_secret_hash, site_name, redirect_uri, status, created_at, approved_at) VALUES (?, ?, ?, ?, ?, 'approved', '2026-01-01', '2026-01-01') " +
    "ON CONFLICT(client_id) DO UPDATE SET client_secret_hash = excluded.client_secret_hash, status = 'approved', redirect_uri = excluded.redirect_uri"
  ).bind(`fed_${clientId}`, clientId, await sha256Hex(clientSecret), clientId, "http://example.com/v1/auth/peer/callback").run();
}

/** The state-binding cookie /peer/:key/start sets, pulled from its Set-Cookie so it can be sent back
 * on /peer/callback the way a real browser would (state is now bound to this cookie, not self-contained). */
const stateCookie = (res: Response) => res.headers.get("Set-Cookie")!.split(";")[0]!;

/** Drives /peer/:key/start -> (self) /federation/authorize as the given issuer-side user -> returns the {code, state, cookie} the consumer's callback/token endpoints would receive. */
async function mintPeerCodeAndState(key: string, clientId: string, issuerSideToken: string) {
  const start = await call(`/auth/peer/${key}/start?next=/dashboard`);
  const startLocation = new URL(start.res.headers.get("Location")!);
  const state = startLocation.searchParams.get("state")!;
  const redirectUri = startLocation.searchParams.get("redirect_uri")!;
  const authorize = await call(
    `/auth/federation/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    { headers: { Authorization: `Bearer ${issuerSideToken}` } }
  );
  const authorizeLocation = new URL(authorize.res.headers.get("Location")!);
  return { code: authorizeLocation.searchParams.get("code")!, state, cookie: stateCookie(start.res) };
}

describe("peer federation: consumer side", () => {
  it("starts sign-in with the configured self-trust peers and reports them in /config", async () => {
    const config = await call("/auth/config");
    expect(config.body.data.providers.peer).toEqual([
      { key: "0", label: "self" },
      { key: "1", label: "self-nosignup" },
    ]);

    const start = await call("/auth/peer/0/start?next=/dashboard");
    expect(start.status).toBe(302);
    const location = new URL(start.res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("http://example.com/v1/auth/federation/authorize");
    expect(location.searchParams.get("client_id")).toBe("fedcli_test");
    expect(location.searchParams.get("redirect_uri")).toBe("http://example.com/v1/auth/peer/callback");
    expect(location.searchParams.get("state")).toBeTruthy();

    expect((await call("/auth/peer/9/start")).status).toBe(404);
  });

  it("completes the full callback round-trip: new user auto-provisioned, repeat sign-in reuses the same user", async () => {
    await seedApprovedSelfTrustClient("fedcli_test", "test-secret-value");
    const issuerSideToken = await signInAs("usr_selffed_identity");

    const first = await mintPeerCodeAndState("0", "fedcli_test", issuerSideToken);
    const firstCallback = await call(`/auth/peer/callback?code=${first.code}&state=${first.state}`, { headers: { Cookie: first.cookie } });
    expect(firstCallback.status).toBe(302);
    expect(firstCallback.res.headers.get("Location")).toBe("http://localhost:5173/dashboard");
    const firstSessionCookie = firstCallback.res.headers.get("Set-Cookie");
    expect(firstSessionCookie).toBeTruthy();

    const identity = await env.DB.prepare("SELECT user_id FROM auth_identities WHERE provider = 'kashi' AND subject = ?")
      .bind("http://example.com/v1/auth|usr_selffed_identity").first<{ user_id: string }>();
    expect(identity).toBeTruthy();

    // hooks.onFederationSession (see src/auth.ts) associates the peer identity with the new local
    // session's family via ExtensionStore.linkPeer, recorded in auth_peer_sessions.
    const peerSession = await env.DB.prepare("SELECT user_id, subject FROM auth_peer_sessions WHERE user_id = ?").bind(identity!.user_id).first<{ user_id: string; subject: string }>();
    expect(peerSession).toMatchObject({ user_id: identity!.user_id, subject: "http://example.com/v1/auth|usr_selffed_identity" });

    // Signing in again through the same peer with the same underlying identity must not create a second local user.
    const second = await mintPeerCodeAndState("0", "fedcli_test", issuerSideToken);
    const secondCallback = await call(`/auth/peer/callback?code=${second.code}&state=${second.state}`, { headers: { Cookie: second.cookie } });
    expect(secondCallback.status).toBe(302);
    const identityAgain = await env.DB.prepare("SELECT user_id FROM auth_identities WHERE provider = 'kashi' AND subject = ?")
      .bind("http://example.com/v1/auth|usr_selffed_identity").first<{ user_id: string }>();
    expect(identityAgain?.user_id).toBe(identity?.user_id);
  });

  it("redirects with OAUTH_STATE_INVALID for a missing or tampered state, and OAUTH_FAILED for a bad code", async () => {
    await seedApprovedSelfTrustClient("fedcli_test", "test-secret-value");

    const missingState = await call("/auth/peer/callback?code=whatever");
    expect(missingState.status).toBe(302);
    expect(missingState.res.headers.get("Location")).toBe("http://localhost:5173/sign-in?error=OAUTH_STATE_INVALID");

    const tamperedState = await call("/auth/peer/callback?code=whatever&state=not-a-real-signed-state");
    expect(tamperedState.status).toBe(302);
    expect(tamperedState.res.headers.get("Location")).toBe("http://localhost:5173/sign-in?error=OAUTH_STATE_INVALID");

    const start = await call("/auth/peer/0/start?next=/dashboard");
    const state = new URL(start.res.headers.get("Location")!).searchParams.get("state")!;
    const badCode = await call(`/auth/peer/callback?code=this-code-was-never-issued&state=${state}`, { headers: { Cookie: stateCookie(start.res) } });
    expect(badCode.status).toBe(302);
    expect(badCode.res.headers.get("Location")).toBe("http://localhost:5173/sign-in?error=OAUTH_FAILED");
  });

  it("blocks auto-provisioning for a brand-new identity when the trust config disables sign-up", async () => {
    await seedApprovedSelfTrustClient("fedcli_test_nosignup", "test-secret-value-2");
    const issuerSideToken = await signInAs("usr_selffed_nosignup");

    const { code, state, cookie } = await mintPeerCodeAndState("1", "fedcli_test_nosignup", issuerSideToken);
    const callback = await call(`/auth/peer/callback?code=${code}&state=${state}`, { headers: { Cookie: cookie } });
    // userForIdentity throws SIGN_UP_DISABLED for a subject with no existing account; the callback
    // route catches every exchange/provisioning failure and reports it uniformly as OAUTH_FAILED.
    expect(callback.status).toBe(302);
    expect(callback.res.headers.get("Location")).toBe("http://localhost:5173/sign-in?error=OAUTH_FAILED");

    const identity = await env.DB.prepare("SELECT user_id FROM auth_identities WHERE provider = 'kashi' AND subject = ?")
      .bind("http://example.com/v1/auth|usr_selffed_nosignup").first();
    expect(identity).toBeNull();
  });

  it("/peer/token completes the native-app exchange flow, and rejects a bad code or unknown peer", async () => {
    await seedApprovedSelfTrustClient("fedcli_test", "test-secret-value");
    const issuerSideToken = await signInAs("usr_selffed_native");

    const { code } = await mintPeerCodeAndState("0", "fedcli_test", issuerSideToken);
    const tokenExchange = await call("/auth/peer/token", { method: "POST", json: { key: "0", code, transport: "token" } });
    expect(tokenExchange.status).toBe(200);
    expect(tokenExchange.body.data.accessToken).toBeTruthy();

    const badCode = await call("/auth/peer/token", { method: "POST", json: { key: "0", code: "this-code-was-never-issued", transport: "token" } });
    expect(badCode.status).toBe(401);
    expect(badCode.body.code).toBe("OAUTH_FAILED");

    const unknownPeer = await call("/auth/peer/token", { method: "POST", json: { key: "9", code: "whatever", transport: "token" } });
    expect(unknownPeer.status).toBe(404);
  });

  it("rejects a federation authorization code once it has expired, distinctly from an already-consumed one", async () => {
    await seedApprovedSelfTrustClient("fedcli_test", "test-secret-value");
    const issuerSideToken = await signInAs("usr_selffed_expiry");
    const { code } = await mintPeerCodeAndState("0", "fedcli_test", issuerSideToken);

    // Backdate the code's expiry directly, rather than waiting out its real 60s TTL.
    await env.DB.prepare("UPDATE auth_federation_codes SET expires_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(code).run();

    const expired = await call("/auth/federation/token", {
      method: "POST",
      json: { grant_type: "authorization_code", code, clientId: "fedcli_test", clientSecret: "test-secret-value", redirectUri: "http://example.com/v1/auth/peer/callback" },
    });
    expect(expired.status).toBe(400);
    expect(expired.body.code).toBe("INVALID_GRANT");
  });
});

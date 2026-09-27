import { env, SELF } from "cloudflare:test";
import { hashPassword } from "@softwareseva/core/server";
import { describe, expect, it } from "vitest";

type Json = { data?: any; code?: string };
const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const res = await SELF.fetch(`http://example.com/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
  return { res, status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};

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
});

describe("peer federation: consumer side", () => {
  it("starts sign-in with the configured self-trust peer and reports it in /config", async () => {
    const config = await call("/auth/config");
    expect(config.body.data.providers.peer).toEqual([{ key: "0", label: "self" }]);

    const start = await call("/auth/peer/0/start?next=/dashboard");
    expect(start.status).toBe(302);
    const location = new URL(start.res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("http://example.com/v1/auth/federation/authorize");
    expect(location.searchParams.get("client_id")).toBe("fedcli_test");
    expect(location.searchParams.get("redirect_uri")).toBe("http://example.com/v1/auth/peer/callback");
    expect(location.searchParams.get("state")).toBeTruthy();

    expect((await call("/auth/peer/9/start")).status).toBe(404);
  });
});

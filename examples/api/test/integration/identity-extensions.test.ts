import { env, SELF } from "cloudflare:test";
import { resolveEnv, signAccessToken } from "@softwareseva/auth/server";
import { describe, expect, it } from "vitest";
import { authConfig } from "../../src/auth";

type Json = { data?: any; code?: string };
const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const res = await SELF.fetch(`http://example.com/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
  return { res, status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const lastCode = async (destination: string) => (await env.DB.prepare("SELECT body FROM dev_outbox WHERE destination = ? ORDER BY id DESC LIMIT 1").bind(destination).first<{ body: string }>())?.body;
const cookiesFrom = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// The OTP request rate limit is keyed by client IP (default "unknown" here), not destination —
// give each sign-in its own fake IP so the many sign-ins across this file's tests don't collide.
let nextIp = 1;
const uniqueIpHeaders = () => ({ "CF-Connecting-IP": `10.0.0.${nextIp++}` });

async function signInByEmailOtp(email: string) {
  const ip = uniqueIpHeaders();
  await call("/auth/otp/request", { method: "POST", json: { channel: "email", destination: email }, headers: ip });
  const code = await lastCode(email);
  const verify = await call("/auth/otp/verify", { method: "POST", json: { channel: "email", destination: email, code }, headers: ip });
  return { code, cookie: verify.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}

// Google's token/userinfo endpoints are stubbed rather than called for real; anything else passes through.
const nativeFetch = globalThis.fetch;
let googleProfile: { sub: string; email: string; email_verified: boolean } | null = null;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
  if (url.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
  if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) return new Response(JSON.stringify(googleProfile), { status: 200 });
  return nativeFetch(input as never, init);
}) as typeof fetch;

describe("otpChannels (multi-channel OTP)", () => {
  it("reports configured channels in /config alongside the legacy single-channel provider", async () => {
    const config = await call("/auth/config");
    expect(config.body.data.providers.otpChannels).toEqual(["email"]);
    expect(config.body.data.providers.otp).toEqual({ channel: "phone" });
  });

  it("signs up over email via otpChannels, independently of the legacy phone channel", async () => {
    const { code, cookie } = await signInByEmailOtp("otpchannel@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(cookie).toContain("access=");

    // Legacy single-channel (phone) still works unaffected, sharing the same /otp/* paths.
    await call("/auth/otp/request", { method: "POST", json: { destination: "9000000010" }, headers: uniqueIpHeaders() });
    const phoneCode = await lastCode("+919000000010");
    expect(phoneCode).toMatch(/^\d{6}$/);
    const phoneVerify = await call("/auth/otp/verify", { method: "POST", json: { destination: "9000000010", code: phoneCode, transport: "token" }, headers: uniqueIpHeaders() });
    expect(phoneVerify.status).toBe(200);
  });

  it("isolates sign-in and contact-link purposes: a sign-in code cannot verify a contact-link request and vice versa", async () => {
    const { cookie } = await signInByEmailOtp("purpose-owner@example.com");

    // Request a *contact-link* code for a second email while authenticated.
    await call("/auth/contacts/otp/request", { method: "POST", json: { channel: "email", destination: "purpose-link@example.com" }, headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    const linkCode = await lastCode("purpose-link@example.com");
    expect(linkCode).toMatch(/^\d{6}$/);

    // That contact-link code must not verify as a *sign-in* code for the same destination.
    const crossPurpose = await call("/auth/otp/verify", { method: "POST", json: { channel: "email", destination: "purpose-link@example.com", code: linkCode } });
    expect(crossPurpose.body.code).toBe("INVALID_CODE");

    // It does verify as a contact-link, attaching the email to the signed-in account.
    const link = await call("/auth/contacts/otp/verify", { method: "POST", json: { channel: "email", destination: "purpose-link@example.com", code: linkCode }, headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    expect(link.status).toBe(200);
    expect(link.body.data.user.email).toBe("purpose-link@example.com");
  });

  it("rejects linking a contact already owned by a different account", async () => {
    await signInByEmailOtp("owner-a@example.com");
    const { cookie: cookieB } = await signInByEmailOtp("owner-b@example.com");
    await call("/auth/contacts/otp/request", { method: "POST", json: { channel: "email", destination: "owner-a@example.com" }, headers: { Cookie: cookieB, Origin: "http://localhost:5173" } });
    const code = await lastCode("owner-a@example.com");
    const attempt = await call("/auth/contacts/otp/verify", { method: "POST", json: { channel: "email", destination: "owner-a@example.com", code }, headers: { Cookie: cookieB, Origin: "http://localhost:5173" } });
    expect(attempt.body.code).toBe("ACCOUNT_MERGE_REQUIRED");
  });

  it("rejects an expired code", async () => {
    const ip = uniqueIpHeaders();
    await call("/auth/otp/request", { method: "POST", json: { channel: "email", destination: "expiring@example.com" }, headers: ip });
    const code = await lastCode("expiring@example.com");
    await env.DB.prepare("UPDATE auth_bound_otp SET expires_at = '2026-01-01T00:00:00.000Z' WHERE destination = ?").bind("expiring@example.com").run();
    const verify = await call("/auth/otp/verify", { method: "POST", json: { channel: "email", destination: "expiring@example.com", code }, headers: ip });
    expect(verify.body.code).toBe("INVALID_CODE");
  });

  it("rejects a contact-link request without a recent session (requireRecent)", async () => {
    const { cookie } = await signInByEmailOtp("stale-session@example.com");
    // Backdate the session family so it no longer counts as "recent" (requireRecent's 5-minute window).
    await env.DB.prepare("UPDATE auth_refresh_sessions SET created_at = '2020-01-01T00:00:00.000Z' WHERE user_id = (SELECT id FROM auth_users WHERE email = ?)").bind("stale-session@example.com").run();
    const request = await call("/auth/contacts/otp/request", { method: "POST", json: { channel: "email", destination: "another@example.com" }, headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    expect(request.body.code).toBe("REAUTH_REQUIRED");
  });
});

describe("Google account linking", () => {
  it("links a fresh Google identity to the signed-in account", async () => {
    const { cookie } = await signInByEmailOtp("link-target@example.com");
    googleProfile = { sub: "google-sub-fresh", email: "google-fresh@example.com", email_verified: true };
    const start = await call("/auth/google/link/start", { headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    expect(start.status).toBe(302);
    const state = new URL(start.res.headers.get("Location")!).searchParams.get("state")!;
    const callback = await call(`/auth/google/link/callback?code=fake-code&state=${state}`, { headers: { Cookie: `${cookie}; ${cookiesFrom(start.res)}`, Origin: "http://localhost:5173" } });
    expect(callback.status).toBe(302);
    expect(callback.res.headers.get("Location")).not.toContain("error=");
    const identity = await env.DB.prepare("SELECT * FROM auth_identities WHERE provider = 'google' AND subject = ?").bind("google-sub-fresh").first();
    expect(identity).toBeTruthy();
  });

  it("rejects linking a Google identity whose verified email belongs to a different account", async () => {
    await signInByEmailOtp("existing-owner@example.com");
    const { cookie: attackerCookie } = await signInByEmailOtp("attacker@example.com");
    googleProfile = { sub: "google-sub-collision", email: "existing-owner@example.com", email_verified: true };
    const start = await call("/auth/google/link/start", { headers: { Cookie: attackerCookie, Origin: "http://localhost:5173" } });
    expect(start.status).toBe(302);
    const state = new URL(start.res.headers.get("Location")!).searchParams.get("state")!;
    const callback = await call(`/auth/google/link/callback?code=fake-code&state=${state}`, { headers: { Cookie: `${attackerCookie}; ${cookiesFrom(start.res)}`, Origin: "http://localhost:5173" } });
    expect(callback.status).toBe(302);
    expect(callback.res.headers.get("Location")).toContain("error=ACCOUNT_MERGE_REQUIRED");
    const identity = await env.DB.prepare("SELECT * FROM auth_identities WHERE provider = 'google' AND subject = ?").bind("google-sub-collision").first();
    expect(identity).toBeNull();
  });
});

describe("recovery codes", () => {
  it("issues, single-use consumes, and rejects reuse", async () => {
    const { cookie } = await signInByEmailOtp("recovery-owner@example.com");
    const issue = await call("/auth/recovery/codes", { method: "POST", headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    expect(issue.status).toBe(200);
    const codes = issue.body.data.codes as string[];
    expect(codes).toHaveLength(10);

    const signIn = await call("/auth/recovery/sign-in", { method: "POST", json: { code: codes[0] } });
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.user.email).toBe("recovery-owner@example.com");

    const reuse = await call("/auth/recovery/sign-in", { method: "POST", json: { code: codes[0] } });
    expect(reuse.body.code).toBe("INVALID_CODE");

    // A second code from the same batch still works — consumption is per-code, not per-batch.
    const secondCode = await call("/auth/recovery/sign-in", { method: "POST", json: { code: codes[1] } });
    expect(secondCode.status).toBe(200);
  });

  it("requires a recent session before issuing codes", async () => {
    const { cookie } = await signInByEmailOtp("recovery-stale@example.com");
    await env.DB.prepare("UPDATE auth_refresh_sessions SET created_at = '2020-01-01T00:00:00.000Z' WHERE user_id = (SELECT id FROM auth_users WHERE email = ?)").bind("recovery-stale@example.com").run();
    const issue = await call("/auth/recovery/codes", { method: "POST", headers: { Cookie: cookie, Origin: "http://localhost:5173" } });
    expect(issue.body.code).toBe("REAUTH_REQUIRED");
  });
});

describe("session revocation (enforceSessionRevocation)", () => {
  it("rejects a bearer token whose refresh-session family has been revoked", async () => {
    const ip = uniqueIpHeaders();
    await call("/auth/otp/request", { method: "POST", json: { destination: "9000000020" }, headers: ip });
    const code = await lastCode("+919000000020");
    const verify = await call("/auth/otp/verify", { method: "POST", json: { destination: "9000000020", code, transport: "token" }, headers: ip });
    const accessToken = verify.body.data.accessToken as string;
    expect((await call("/account", { headers: { Authorization: `Bearer ${accessToken}` } })).status).toBe(200);

    await env.DB.prepare("UPDATE auth_refresh_sessions SET revoked_at = '2026-01-01T00:00:00.000Z' WHERE user_id = ?").bind(verify.body.data.user.id).run();

    const afterRevoke = await call("/account", { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.body.code).toBe("UNAUTHORIZED");
  });
});

describe("last authentication method protection", () => {
  it("blocks removing the only passkey from an otherwise-unreachable account", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO auth_users(id, display_name, roles, created_at, updated_at) VALUES ('usr_lastauth', 'Only Passkey', '[\"user\"]', '2026-01-01', '2026-01-01')"),
      env.DB.prepare("INSERT INTO auth_passkeys(id, user_id, credential_id, public_key, counter, device_name, rp_id, created_at) VALUES ('pk_lastauth', 'usr_lastauth', 'cred_lastauth', 'pub', 0, 'Only device', 'localhost', '2026-01-01')"),
      env.DB.prepare("INSERT INTO auth_refresh_sessions(id, user_id, family_id, token_hash, expires_at, created_at) VALUES ('rs_lastauth', 'usr_lastauth', 'fam_lastauth', 'unused-lastauth', '2099-01-01', '2026-01-01')"),
    ]);
    const e = resolveEnv(authConfig, env as unknown as Record<string, unknown>);
    const token = await signAccessToken(authConfig, e, { id: "usr_lastauth", name: "Only Passkey", email: null, phone: null, roles: ["user"], emailVerifiedAt: null, phoneVerifiedAt: null }, "fam_lastauth");

    const blocked = await call("/auth/passkeys/pk_lastauth", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("LAST_AUTH_METHOD");

    // Once a recovery code exists, the passkey is no longer the last way in.
    await env.DB.prepare("INSERT INTO auth_recovery_codes(code_hash, user_id, created_at) VALUES ('hash-lastauth', 'usr_lastauth', '2026-01-01')").run();
    const allowed = await call("/auth/passkeys/pk_lastauth", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    expect(allowed.status).toBe(200);
  });
});

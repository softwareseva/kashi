import { env, SELF } from "cloudflare:test";
import { hashPassword } from "@softwareseva/core/server";
import { resolveEnv, signAccessToken } from "@softwareseva/auth/server";
import { describe, expect, it } from "vitest";
import { authConfig } from "../../src/auth";

const ORIGIN = "http://localhost:5173";
type Json = { data?: any; code?: string; fields?: Record<string, string[]> };
const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const res = await SELF.fetch(`http://example.com/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
  return { res, status: res.status, body: (await res.json().catch(() => ({}))) as Json };
};
const cookiesFrom = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const lastCode = async (destination: string) => (await env.DB.prepare("SELECT body FROM dev_outbox WHERE destination = ? ORDER BY id DESC LIMIT 1").bind(destination).first<{ body: string }>())?.body;

describe("auth config", () => {
  it("reports providers; unconfigured OAuth is reported as disabled", async () => {
    const { body } = await call("/auth/config");
    expect(body.data.providers).toMatchObject({ password: true, otp: { channel: "phone" }, google: false, apple: false, facebook: false, passkeys: true, passkeySignUp: true });
  });
});

describe("otp", () => {
  it("signs up with a phone code and returns a token pair", async () => {
    expect((await call("/auth/otp/request", { method: "POST", json: { destination: "98765 43210" } })).status).toBe(200);
    const code = await lastCode("+919876543210");
    expect(code).toMatch(/^\d{6}$/);
    const bad = await call("/auth/otp/verify", { method: "POST", json: { destination: "9876543210", code: code === "000000" ? "111111" : "000000", transport: "token" } });
    expect(bad.body.code).toBe("INVALID_CODE");
    const { status, body } = await call("/auth/otp/verify", { method: "POST", json: { destination: "+91 98765 43210", code, name: "Asha", transport: "token" } });
    expect(status).toBe(200);
    expect(body.data.user).toMatchObject({ name: "Asha", phone: "+919876543210", roles: ["user"] });
    expect(body.data.accessToken).toBeTruthy();
    const me = await call("/account", { headers: { Authorization: `Bearer ${body.data.accessToken}` } });
    expect(me.body.data.name).toBe("Asha");
  });

  it("does not reveal invalid destinations and locks after too many attempts", async () => {
    expect((await call("/auth/otp/request", { method: "POST", json: { destination: "not a phone" } })).status).toBe(200);
    await call("/auth/otp/request", { method: "POST", json: { destination: "9123456789" } });
    for (let i = 0; i < 5; i++) await call("/auth/otp/verify", { method: "POST", json: { destination: "9123456789", code: "000001" } });
    const code = await lastCode("+919123456789");
    const locked = await call("/auth/otp/verify", { method: "POST", json: { destination: "9123456789", code } });
    expect(locked.body.code).toBe("INVALID_CODE");
  });
});

describe("password + cookie sessions", () => {
  it("signs in with cookies, enforces origin on mutations, refreshes, and logs out", async () => {
    await env.DB.prepare("INSERT INTO auth_users(id, display_name, email, roles, password_hash, created_at, updated_at) VALUES ('usr_admin', 'Admin', 'admin@example.com', '[\"user\",\"admin\"]', ?, '2026-01-01', '2026-01-01')").bind(await hashPassword("correct horse battery")).run();
    const wrong = await call("/auth/password/sign-in", { method: "POST", json: { identifier: "admin@example.com", password: "nope" } });
    expect(wrong.body.code).toBe("INVALID_CREDENTIALS");
    const unknown = await call("/auth/password/sign-in", { method: "POST", json: { identifier: "ghost@example.com", password: "nope" } });
    expect(unknown.body.code).toBe("INVALID_CREDENTIALS");

    const signIn = await call("/auth/password/sign-in", { method: "POST", json: { identifier: "ADMIN@example.com", password: "correct horse battery" } });
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.accessToken).toBeUndefined();
    const cookie = cookiesFrom(signIn.res);
    expect(cookie).toContain("access=");

    expect((await call("/account/admin", { headers: { Cookie: cookie } })).body.data).toEqual({ admin: true });
    expect((await call("/auth/logout-all", { method: "POST", headers: { Cookie: cookie, Origin: "https://evil.example" } })).status).toBe(403);

    const refreshed = await call("/auth/refresh", { method: "POST", headers: { Cookie: cookie, Origin: ORIGIN } });
    expect(refreshed.status).toBe(200);
    const reused = await call("/auth/refresh", { method: "POST", headers: { Cookie: cookie, Origin: ORIGIN } });
    expect(reused.body.code).toBe("TOKEN_REUSE");
    const afterReuse = await call("/auth/refresh", { method: "POST", headers: { Cookie: cookiesFrom(refreshed.res), Origin: ORIGIN } });
    expect(afterReuse.status).toBe(401);
  });

  it("forbids non-admins from admin routes", async () => {
    await env.DB.prepare("INSERT INTO auth_users(id, display_name, email, roles, password_hash, created_at, updated_at) VALUES ('usr_plain', 'Plain', 'plain@example.com', '[\"user\"]', ?, '2026-01-01', '2026-01-01')").bind(await hashPassword("correct horse battery")).run();
    const signIn = await call("/auth/password/sign-in", { method: "POST", json: { identifier: "plain@example.com", password: "correct horse battery", transport: "token" } });
    const res = await call("/account/admin", { headers: { Authorization: `Bearer ${signIn.body.data.accessToken}` } });
    expect(res.status).toBe(403);
    expect((await call("/account")).status).toBe(401);
  });
});

describe("token transport", () => {
  it("rotates refresh tokens and revokes the family on reuse", async () => {
    await call("/auth/otp/request", { method: "POST", json: { destination: "9000000001" } });
    const first = await call("/auth/otp/verify", { method: "POST", json: { destination: "9000000001", code: await lastCode("+919000000001"), transport: "token" } });
    const r1 = first.body.data.refreshToken as string;
    const second = await call("/auth/token/refresh", { method: "POST", json: { refreshToken: r1 } });
    expect(second.status).toBe(200);
    const r2 = second.body.data.refreshToken as string;
    expect(r2).not.toBe(r1);
    expect((await call("/auth/token/refresh", { method: "POST", json: { refreshToken: r1 } })).body.code).toBe("TOKEN_REUSE");
    expect((await call("/auth/token/refresh", { method: "POST", json: { refreshToken: r2 } })).status).toBe(401);
  });
});

describe("passkeys", () => {
  it("issues discoverable authentication options and requires a session to register", async () => {
    const opts = await call("/auth/passkeys/authenticate/options", { method: "POST", json: {} });
    expect(opts.status).toBe(200);
    expect(opts.body.data.options.rpId).toBe("localhost");
    expect(opts.body.data.challengeId).toMatch(/^ch_/);
    expect((await call("/auth/passkeys/register/options", { method: "POST", json: {} })).status).toBe(401);
    const bogus = await call("/auth/passkeys/authenticate/verify", { method: "POST", json: { challengeId: opts.body.data.challengeId, response: { id: "nope", rawId: "nope", type: "public-key", response: {} } } });
    expect(bogus.body.code).toBe("PASSKEY_REJECTED");
  });

  it("returns registration options for a signed-in user", async () => {
    await call("/auth/otp/request", { method: "POST", json: { destination: "9000000002" } });
    const s = await call("/auth/otp/verify", { method: "POST", json: { destination: "9000000002", code: await lastCode("+919000000002"), transport: "token" } });
    const res = await call("/auth/passkeys/register/options", { method: "POST", json: {}, headers: { Authorization: `Bearer ${s.body.data.accessToken}` } });
    expect(res.status).toBe(200);
    expect(res.body.data.options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
  });

  it("issues contact-free sign-up options with no session, and rejects a bogus registration without creating an account", async () => {
    const before = (await env.DB.prepare("SELECT count(*) AS n FROM auth_users").first<{ n: number }>())?.n;
    const opts = await call("/auth/passkeys/signup/options", { method: "POST", json: {} });
    expect(opts.status).toBe(200);
    expect(opts.body.data.options.rp.id).toBe("localhost");
    expect(opts.body.data.options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
    expect(opts.body.data.challengeId).toMatch(/^ch_/);
    const bogus = await call("/auth/passkeys/signup/verify", { method: "POST", json: { challengeId: opts.body.data.challengeId, response: { id: "nope", rawId: "nope", type: "public-key", response: {} } } });
    expect(bogus.body.code).toBe("PASSKEY_REJECTED");
    const after = (await env.DB.prepare("SELECT count(*) AS n FROM auth_users").first<{ n: number }>())?.n;
    expect(after).toBe(before);
  });
});

describe("requireVerified", () => {
  it("blocks an anonymous, passkey-only account and admits one with a verified email/phone", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO auth_users(id, display_name, roles, created_at, updated_at) VALUES ('usr_anon', 'Anon', '[\"user\"]', '2026-01-01', '2026-01-01')"),
      env.DB.prepare("INSERT INTO auth_passkeys(id, user_id, credential_id, public_key, counter, device_name, rp_id, created_at) VALUES ('pk_anon', 'usr_anon', 'cred_anon', 'pub', 0, 'This device', 'localhost', '2026-01-01')"),
    ]);
    const e = resolveEnv(authConfig, env as unknown as Record<string, unknown>);
    const anonToken = await signAccessToken(authConfig, e, { id: "usr_anon", name: "Anon", email: null, phone: null, roles: ["user"], emailVerifiedAt: null, phoneVerifiedAt: null });
    const anonAttempt = await call("/account/payout-details", { headers: { Authorization: `Bearer ${anonToken}` } });
    expect(anonAttempt.status).toBe(403);
    expect(anonAttempt.body.code).toBe("IDENTITY_REQUIRED");

    await call("/auth/otp/request", { method: "POST", json: { destination: "9000000003" } });
    const verified = await call("/auth/otp/verify", { method: "POST", json: { destination: "9000000003", code: await lastCode("+919000000003"), transport: "token" } });
    const verifiedAttempt = await call("/account/payout-details", { headers: { Authorization: `Bearer ${verified.body.data.accessToken}` } });
    expect(verifiedAttempt.status).toBe(200);
    expect(verifiedAttempt.body.data).toEqual({ verified: true });

    const list = await call("/auth/passkeys", { headers: { Authorization: `Bearer ${anonToken}` } });
    expect(list.body.data.items).toEqual([expect.objectContaining({ id: "pk_anon", deviceName: "This device", rpId: "localhost" })]);
  });
});

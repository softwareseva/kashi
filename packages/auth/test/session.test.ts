import { describe, expect, it } from "vitest";
import { verify } from "hono/jwt";
import { Hono } from "hono";
import { bearer, signAccessToken } from "../src/server/session";
import type { AuthConfig, AuthEnv, AuthUser } from "../src/server/types";

const env: AuthEnv = { db: null as never, jwtSecret: "secret", issuer: "i", audience: "a", origins: [], appOrigin: "https://app.test", authUrl: "https://app.test/v1/auth", secureCookies: true };
const config: AuthConfig = { providers: {} };
const user: AuthUser = { id: "usr_1", name: "Asha", email: null, phone: null, roles: ["user"], emailVerifiedAt: null, phoneVerifiedAt: null };

describe("signAccessToken", () => {
  it("embeds the family id as `sid` when given, for enforceSessionRevocation / requireRecent to read back", async () => {
    const token = await signAccessToken(config, env, user, "fam_123");
    const claims = await verify(token, env.jwtSecret, { alg: "HS256", iss: env.issuer, aud: env.audience });
    expect(claims.sid).toBe("fam_123");
  });

  it("omits `sid` when no family id is given, unchanged from 1.4.0 behavior", async () => {
    const token = await signAccessToken(config, env, user);
    const claims = await verify(token, env.jwtSecret, { alg: "HS256", iss: env.issuer, aud: env.audience });
    expect(claims.sid).toBeUndefined();
  });
});

describe("bearer", () => {
  it("matches the Authorization scheme case-insensitively, as requireAuth and requireRecent both rely on", async () => {
    const app = new Hono().get("/", (c) => c.json({ token: bearer(c) }));
    for (const scheme of ["Bearer", "bearer", "BEARER"])
      expect(await (await app.request("/", { headers: { Authorization: `${scheme} tok_1` } })).json()).toEqual({ token: "tok_1" });
    expect(await (await app.request("/", { headers: { Authorization: "Basic abc" } })).json()).toEqual({ token: null });
  });
});

import { describe, expect, it } from "vitest";
import { googleAuthorizeUrl, safeNext, signOAuthState, verifyGoogleIdToken, verifyOAuthState } from "../src/server/providers/google";
import type { AuthEnv } from "../src/server/types";

const env: AuthEnv = { db: null as never, jwtSecret: "secret", issuer: "i", audience: "a", origins: ["https://app.test"], appOrigin: "https://app.test", authUrl: "https://api.test/v1/auth", secureCookies: true, googleClientId: "cid", googleClientSecret: "cs" };

describe("google", () => {
  it("round-trips signed state and rejects tampering", async () => {
    const token = await signOAuthState(env, { next: "/dash", transport: "cookie" });
    expect(await verifyOAuthState(env, token)).toEqual({ next: "/dash", transport: "cookie" });
    expect(await verifyOAuthState({ ...env, jwtSecret: "other" }, token)).toBeNull();
  });
  it("only allows relative next paths", () => {
    expect(safeNext("/a/b?x=1")).toBe("/a/b?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
  });
  it("builds the authorize url", () => {
    const url = new URL(googleAuthorizeUrl(env, "https://api.test/v1/auth/google/callback", "st"));
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });
  it("verifies id tokens via tokeninfo and checks the audience", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ aud: "cid", sub: "123", email: "A@B.com", email_verified: "true", name: "A B" }))) as unknown as typeof fetch;
    expect(await verifyGoogleIdToken(env, "tok", fetcher)).toEqual({ subject: "123", email: "a@b.com", emailVerified: true, name: "A B" });
    const wrong = (async () => new Response(JSON.stringify({ aud: "other", sub: "123" }))) as unknown as typeof fetch;
    await expect(verifyGoogleIdToken(env, "tok", wrong)).rejects.toThrow(/audience/);
  });
});

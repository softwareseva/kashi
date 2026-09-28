import { describe, expect, it } from "vitest";
import { facebookAuthorizeUrl, verifyFacebookAccessToken } from "../src/server/providers/facebook";
import type { AuthEnv } from "../src/server/types";

const env: AuthEnv = { db: null as never, jwtSecret: "secret", issuer: "i", audience: "a", origins: ["https://app.test"], appOrigin: "https://app.test", authUrl: "https://api.test/v1/auth", secureCookies: true, facebookClientId: "cid", facebookClientSecret: "cs" };

describe("facebook", () => {
  it("builds the authorize url", () => {
    const url = new URL(facebookAuthorizeUrl(env, "https://api.test/v1/auth/facebook/callback", "st"));
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("scope")).toBe("email public_profile");
  });
  it("verifies access tokens via debug_token and checks the app id, treating a returned email as verified", async () => {
    const fetcher = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("debug_token")) return new Response(JSON.stringify({ data: { app_id: "cid", is_valid: true } }));
      return new Response(JSON.stringify({ id: "123", name: "A B", email: "A@B.com" }));
    }) as unknown as typeof fetch;
    expect(await verifyFacebookAccessToken(env, "tok", fetcher)).toEqual({ subject: "123", email: "a@b.com", emailVerified: true, name: "A B" });
    const wrong = (async () => new Response(JSON.stringify({ data: { app_id: "other", is_valid: true } }))) as unknown as typeof fetch;
    await expect(verifyFacebookAccessToken(env, "tok", wrong)).rejects.toThrow(/audience/);
  });
});

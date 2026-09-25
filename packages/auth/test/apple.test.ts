import { describe, expect, it } from "vitest";
import { appleClientSecret, appleNameFromUserJson, verifyAppleIdToken } from "../src/server/providers/apple";
import type { AuthEnv } from "../src/server/types";

async function pemKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8)).match(/.{1,64}/g)!.join("\n");
  return { pem: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`, publicKey: pair.publicKey };
}
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const env = (over: Partial<AuthEnv>): AuthEnv => ({ db: null as never, jwtSecret: "s", issuer: "i", audience: "a", origins: ["https://app.test"], appOrigin: "https://app.test", authUrl: "https://api.test/v1/auth", secureCookies: true, appleClientId: "com.example.web", appleTeamId: "TEAM123456", appleKeyId: "KEY1234567", appleBundleIds: ["com.example.ios"], ...over });

describe("apple", () => {
  it("mints an ES256 client secret Apple can verify", async () => {
    const { pem, publicKey } = await pemKey();
    const jwt = await appleClientSecret(env({ applePrivateKey: pem }));
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(atob(h!.replaceAll("-", "+").replaceAll("_", "/")))).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    const payload = JSON.parse(atob(p!.replaceAll("-", "+").replaceAll("_", "/")));
    expect(payload).toMatchObject({ iss: "TEAM123456", aud: "https://appleid.apple.com", sub: "com.example.web" });
    const sig = Uint8Array.from(atob(s!.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sig, new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });

  it("verifies an RS256 id token against a JWKS and accepts bundle-id audiences", async () => {
    const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
    const now = Math.floor(Date.now() / 1000);
    const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
    const input = `${enc({ alg: "RS256", kid: "k1" })}.${enc({ iss: "https://appleid.apple.com", aud: "com.example.ios", sub: "001234.abc", email: "Relay@privaterelay.appleid.com", email_verified: "true", is_private_email: "true", iat: now, exp: now + 600 })}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input)));
    const token = `${input}.${b64url(sig)}`;
    const fetcher = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch;
    const profile = await verifyAppleIdToken(env({}), token, fetcher);
    expect(profile).toMatchObject({ subject: "001234.abc", email: "relay@privaterelay.appleid.com", emailVerified: true, isPrivateEmail: true });
    await expect(verifyAppleIdToken(env({ appleClientId: "other", appleBundleIds: [] }), token, fetcher)).rejects.toThrow(/audience/);
  });

  it("extracts the first-login name", () => {
    expect(appleNameFromUserJson(JSON.stringify({ name: { firstName: "Ada", lastName: "Lovelace" } }))).toBe("Ada Lovelace");
    expect(appleNameFromUserJson(undefined)).toBeNull();
  });
});

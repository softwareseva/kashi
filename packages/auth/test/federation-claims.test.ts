import { describe, expect, it } from "vitest";
import { generateFederationKeypair } from "../src/server/federation/keys";
import { signFederationIdToken } from "../src/server/providers/peer-issuer";
import type { AuthEnv, AuthUser } from "../src/server/types";

const user: AuthUser = { id: "usr_1", name: "Asha", email: "asha@example.com", phone: null, roles: ["user"], emailVerifiedAt: "2026-01-01", phoneVerifiedAt: null };

describe("signFederationIdToken with hooks.federationClaims", () => {
  it("merges extra claims into the signed ID token", async () => {
    const { privateJwk } = await generateFederationKeypair();
    const env: AuthEnv = { db: null as never, jwtSecret: "unused", issuer: "i", audience: "a", origins: [], appOrigin: "https://issuer.test", authUrl: "https://issuer.test/v1/auth", secureCookies: true, federationPrivateKey: JSON.stringify(privateJwk) };
    const idToken = await signFederationIdToken(env, "cid", user, { organizationId: "org_1" });
    const [, payloadB64] = idToken.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.organizationId).toBe("org_1");
  });

  it("never lets an extra claim override the standard, package-controlled claims", async () => {
    const { privateJwk } = await generateFederationKeypair();
    const env: AuthEnv = { db: null as never, jwtSecret: "unused", issuer: "i", audience: "a", origins: [], appOrigin: "https://issuer.test", authUrl: "https://issuer.test/v1/auth", secureCookies: true, federationPrivateKey: JSON.stringify(privateJwk) };
    const idToken = await signFederationIdToken(env, "cid", user, { sub: "attacker-controlled", aud: "wrong-client" });
    const [, payloadB64] = idToken.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    expect(payload.sub).toBe("usr_1");
    expect(payload.aud).toBe("cid");
  });
});

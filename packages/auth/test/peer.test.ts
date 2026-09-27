import { describe, expect, it } from "vitest";
import { generateFederationKeypair } from "../src/server/federation/keys";
import { federationJwks, signFederationIdToken } from "../src/server/providers/peer-issuer";
import { exchangePeerCode, peerAuthorizeUrl, signPeerState, verifyPeerState } from "../src/server/providers/peer-consumer";
import type { AuthEnv, AuthUser, PeerTrustConfig } from "../src/server/types";

const baseEnv: AuthEnv = { db: null as never, jwtSecret: "secret", issuer: "i", audience: "a", origins: ["https://app.test"], appOrigin: "https://app.test", authUrl: "https://issuer.test/v1/auth", secureCookies: true };
const user: AuthUser = { id: "usr_1", name: "Asha", email: "asha@example.com", phone: null, roles: ["user"], emailVerifiedAt: "2026-01-01", phoneVerifiedAt: null };

describe("peer issuer", () => {
  it("round-trips a signed peer state and rejects tampering", async () => {
    const state = await signPeerState(baseEnv, { key: "0", next: "/dash" });
    expect(await verifyPeerState(baseEnv, state)).toEqual({ key: "0", next: "/dash" });
    expect(await verifyPeerState({ ...baseEnv, jwtSecret: "other" }, state)).toBeNull();
  });

  it("signs an ID token verifiable with its own JWKS, scoped to the client and never using JWT_SECRET", async () => {
    const { privateJwk } = await generateFederationKeypair();
    const env: AuthEnv = { ...baseEnv, authUrl: "https://issuer-a.test/v1/auth", federationPrivateKey: JSON.stringify(privateJwk) };
    const idToken = await signFederationIdToken(env, "cid", user);
    const jwks = federationJwks(env);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).not.toHaveProperty("d"); // public half only
    const trust: PeerTrustConfig = { issuer: env.authUrl, clientId: "cid", clientSecret: "unused-here" };
    const fetcher = (async () => new Response(JSON.stringify({ idToken }))) as unknown as typeof fetch;
    // exchangePeerCode both fetches the token and verifies it against the JWKS it fetches itself;
    // stub the JWKS fetch by returning it on the first call and the token on the second.
    let call = 0;
    const combinedFetcher = (async (input: RequestInfo | URL) => {
      call += 1;
      if (String(input).endsWith("/jwks.json")) return new Response(JSON.stringify(jwks));
      return fetcher(input as never);
    }) as unknown as typeof fetch;
    const profile = await exchangePeerCode(trust, "code", "https://consumer.test/v1/auth/peer/callback", combinedFetcher);
    expect(profile).toEqual({ subject: `${env.authUrl}|usr_1`, email: "asha@example.com", emailVerified: true, name: "Asha" });
    expect(call).toBe(2);
  });

  it("rejects an ID token whose audience does not match the trusted client", async () => {
    const { privateJwk, publicJwk } = await generateFederationKeypair();
    const env: AuthEnv = { ...baseEnv, authUrl: "https://issuer-b.test/v1/auth", federationPrivateKey: JSON.stringify(privateJwk) };
    const idToken = await signFederationIdToken(env, "someone-else", user);
    const trust: PeerTrustConfig = { issuer: env.authUrl, clientId: "cid", clientSecret: "unused-here" };
    const fetcher = (async (input: RequestInfo | URL) =>
      String(input).endsWith("/jwks.json") ? new Response(JSON.stringify({ keys: [publicJwk] })) : new Response(JSON.stringify({ idToken }))) as unknown as typeof fetch;
    await expect(exchangePeerCode(trust, "code", "https://consumer.test/v1/auth/peer/callback", fetcher)).rejects.toThrow(/audience/);
  });

  it("builds the authorize url with the trusted client's id", () => {
    const trust: PeerTrustConfig = { issuer: "https://issuer.test/v1/auth", clientId: "cid", clientSecret: "s" };
    const url = new URL(peerAuthorizeUrl(trust, "https://consumer.test/v1/auth/peer/callback", "st"));
    expect(url.origin + url.pathname).toBe("https://issuer.test/v1/auth/federation/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

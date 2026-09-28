import { describe, expect, it } from "vitest";
import { generateFederationKeypair } from "../src/server/federation/keys";
import { federationJwks, signFederationIdToken } from "../src/server/providers/peer-issuer";
import { exchangePeerCode, peerAuthorizeUrl } from "../src/server/providers/peer-consumer";
import type { AuthEnv, AuthUser, PeerTrustConfig } from "../src/server/types";

const baseEnv: AuthEnv = { db: null as never, jwtSecret: "secret", issuer: "i", audience: "a", origins: ["https://app.test"], appOrigin: "https://app.test", authUrl: "https://issuer.test/v1/auth", secureCookies: true };
const user: AuthUser = { id: "usr_1", name: "Asha", email: "asha@example.com", phone: null, roles: ["user"], emailVerifiedAt: "2026-01-01", phoneVerifiedAt: null };

describe("peer issuer", () => {
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

  it("verifies against the JWKS key matching the token's kid, even when it is not the first key published (key rotation)", async () => {
    const oldKeypair = await generateFederationKeypair();
    const newKeypair = await generateFederationKeypair();
    const env: AuthEnv = { ...baseEnv, authUrl: "https://issuer-rotate.test/v1/auth", federationPrivateKey: JSON.stringify(newKeypair.privateJwk) };
    const idToken = await signFederationIdToken(env, "cid", user);
    const trust: PeerTrustConfig = { issuer: env.authUrl, clientId: "cid", clientSecret: "unused-here" };
    // The published JWKS lists the old key first, as an issuer mid-rotation would while the old key is still valid for tokens already in flight.
    const jwks = { keys: [oldKeypair.publicJwk, newKeypair.publicJwk] };
    const fetcher = (async (input: RequestInfo | URL) =>
      String(input).endsWith("/jwks.json") ? new Response(JSON.stringify(jwks)) : new Response(JSON.stringify({ idToken }))) as unknown as typeof fetch;
    const profile = await exchangePeerCode(trust, "code", "https://consumer.test/v1/auth/peer/callback", fetcher);
    expect(profile.subject).toBe(`${env.authUrl}|usr_1`);
  });

  it("rejects an ID token whose kid does not match any published key, rather than silently trying a different one", async () => {
    const signingKeypair = await generateFederationKeypair();
    const otherKeypair = await generateFederationKeypair();
    const env: AuthEnv = { ...baseEnv, authUrl: "https://issuer-unknown-kid.test/v1/auth", federationPrivateKey: JSON.stringify(signingKeypair.privateJwk) };
    const idToken = await signFederationIdToken(env, "cid", user);
    const trust: PeerTrustConfig = { issuer: env.authUrl, clientId: "cid", clientSecret: "unused-here" };
    // The JWKS the consumer fetches does not contain the key that actually signed the token.
    const jwks = { keys: [otherKeypair.publicJwk] };
    const fetcher = (async (input: RequestInfo | URL) =>
      String(input).endsWith("/jwks.json") ? new Response(JSON.stringify(jwks)) : new Response(JSON.stringify({ idToken }))) as unknown as typeof fetch;
    await expect(exchangePeerCode(trust, "code", "https://consumer.test/v1/auth/peer/callback", fetcher)).rejects.toThrow(/peer_jwks_kid_unknown/);
  });

  it("reuses the cached JWKS within the cache window instead of refetching on a second exchange", async () => {
    const { privateJwk } = await generateFederationKeypair();
    const env: AuthEnv = { ...baseEnv, authUrl: "https://issuer-cache.test/v1/auth", federationPrivateKey: JSON.stringify(privateJwk) };
    const trust: PeerTrustConfig = { issuer: env.authUrl, clientId: "cid", clientSecret: "unused-here" };
    const jwks = federationJwks(env);
    let jwksFetchCount = 0;
    const fetcher = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/jwks.json")) {
        jwksFetchCount += 1;
        return new Response(JSON.stringify(jwks));
      }
      const idToken = await signFederationIdToken(env, "cid", user);
      return new Response(JSON.stringify({ idToken }));
    }) as unknown as typeof fetch;
    await exchangePeerCode(trust, "code-1", "https://consumer.test/v1/auth/peer/callback", fetcher);
    expect(jwksFetchCount).toBe(1);
    await exchangePeerCode(trust, "code-2", "https://consumer.test/v1/auth/peer/callback", fetcher);
    expect(jwksFetchCount).toBe(1); // still cached, no refetch
  });

  it("refetches the JWKS once when a cached set doesn't know the token's kid (issuer rotated within the cache window)", async () => {
    const oldKeypair = await generateFederationKeypair();
    const newKeypair = await generateFederationKeypair();
    const authUrl = "https://issuer-rotate-cached.test/v1/auth";
    const trust: PeerTrustConfig = { issuer: authUrl, clientId: "cid", clientSecret: "unused-here" };
    let signer = oldKeypair; let published = [oldKeypair.publicJwk]; let jwksFetchCount = 0;
    const fetcher = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/jwks.json")) { jwksFetchCount += 1; return new Response(JSON.stringify({ keys: published })); }
      return new Response(JSON.stringify({ idToken: await signFederationIdToken({ ...baseEnv, authUrl, federationPrivateKey: JSON.stringify(signer.privateJwk) }, "cid", user) }));
    }) as unknown as typeof fetch;
    await exchangePeerCode(trust, "code-1", "https://consumer.test/v1/auth/peer/callback", fetcher);
    signer = newKeypair; published = [newKeypair.publicJwk];
    const profile = await exchangePeerCode(trust, "code-2", "https://consumer.test/v1/auth/peer/callback", fetcher);
    expect(profile.subject).toBe(`${authUrl}|usr_1`);
    expect(jwksFetchCount).toBe(2);
    // Still unknown after the refetch: fail, and don't loop.
    signer = await generateFederationKeypair();
    await expect(exchangePeerCode(trust, "code-3", "https://consumer.test/v1/auth/peer/callback", fetcher)).rejects.toThrow(/peer_jwks_kid_unknown/);
    expect(jwksFetchCount).toBe(3);
  });
});

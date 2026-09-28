/** Consuming another kashi site's identities: authorize redirect, code→ID-token exchange, JWKS verification. No SDK, no shared secret with any other provider. */
import { sign, verify } from "hono/jwt";
import { base64UrlToBytes } from "@softwareseva/core/server";
import type { AuthEnv, PeerTrustConfig } from "../types";

const STATE_TYP = "peer_oauth_state";
export type PeerState = { key: string; next: string };
export type FederationProfile = { subject: string; email: string | null; emailVerified: boolean; name: string | null };
type Jwk = JsonWebKey & { kid?: string };

export async function signPeerState(env: AuthEnv, state: PeerState): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ typ: STATE_TYP, ...state, iss: env.issuer, aud: env.audience, iat: now, exp: now + 600 }, env.jwtSecret, "HS256");
}

export async function verifyPeerState(env: AuthEnv, token: string): Promise<PeerState | null> {
  try {
    const p = await verify(token, env.jwtSecret, { alg: "HS256", iss: env.issuer, aud: env.audience });
    return p.typ === STATE_TYP && typeof p.key === "string" && typeof p.next === "string" ? { key: p.key, next: p.next } : null;
  } catch { return null; }
}

const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

async function issuerJwks(issuer: string, fetcher: typeof fetch): Promise<Jwk[]> {
  const cached = jwksCache.get(issuer);
  if (cached && Date.now() - cached.fetchedAt < 3600_000) return cached.keys;
  const res = await fetcher(`${issuer}/federation/.well-known/jwks.json`);
  if (!res.ok) throw new Error("peer_jwks_unavailable");
  // The real endpoint wraps its response in the standard { data } envelope (see ok() in
  // @softwareseva/core/server); unwrap it here rather than expecting a flat body.
  const body = (await res.json()) as { data?: { keys?: Jwk[] }; keys?: Jwk[] };
  const keys = body.data?.keys ?? body.keys ?? [];
  jwksCache.set(issuer, { keys, fetchedAt: Date.now() });
  return keys;
}

export function peerAuthorizeUrl(trust: PeerTrustConfig, redirectUri: string, state: string): string {
  const url = new URL(`${trust.issuer}/federation/authorize`);
  url.searchParams.set("client_id", trust.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchange the authorization code for an ID token, then verify it against the issuer's published JWKS. */
export async function exchangePeerCode(trust: PeerTrustConfig, code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<FederationProfile> {
  const res = await fetcher(`${trust.issuer}/federation/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", code, clientId: trust.clientId, clientSecret: trust.clientSecret, redirectUri }),
  });
  if (!res.ok) throw new Error("peer_token_exchange_failed");
  // The real /federation/token endpoint wraps its response in the standard { data } envelope
  // (see ok() in @softwareseva/core/server); unwrap it here rather than expecting a flat body.
  const body = (await res.json()) as { data?: { idToken?: string }; idToken?: string };
  const idToken = body.data?.idToken ?? body.idToken;
  if (!idToken) throw new Error("peer_token_exchange_failed");
  return verifyPeerIdToken(trust, idToken, fetcher);
}

async function verifyPeerIdToken(trust: PeerTrustConfig, idToken: string, fetcher: typeof fetch): Promise<FederationProfile> {
  const [headerB64] = idToken.split(".");
  const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64 ?? ""))) as { kid?: string; alg?: string };
  if (header.alg !== "RS256") throw new Error("peer_id_token_invalid");
  const keys = await issuerJwks(trust.issuer, fetcher);
  const jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
  if (!jwk) throw new Error("peer_jwks_kid_unknown");
  const payload = await verify(idToken, jwk, "RS256").catch(() => { throw new Error("peer_id_token_invalid"); });
  if (payload.iss !== trust.issuer || payload.aud !== trust.clientId) throw new Error("peer_id_token_wrong_audience");
  if (typeof payload.sub !== "string") throw new Error("peer_id_token_invalid");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  return { subject: `${trust.issuer}|${payload.sub}`, email, emailVerified: payload.email_verified === true, name: typeof payload.name === "string" ? payload.name : null };
}

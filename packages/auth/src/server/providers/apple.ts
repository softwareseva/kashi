/** Sign in with Apple: ES256 client secret, code exchange, ID-token verification against Apple's JWKS, and the native identityToken path. */
import { verify } from "hono/jwt";
import { base64UrlToBytes, bytesToBase64Url } from "@softwareseva/core/server";
import type { AuthEnv } from "../types";

export type AppleProfile = { subject: string; email: string | null; emailVerified: boolean; isPrivateEmail: boolean; name: string | null };
const APPLE_ISS = "https://appleid.apple.com";

export function appleConfigured(env: AuthEnv) { return Boolean(env.appleClientId && env.appleTeamId && env.appleKeyId && env.applePrivateKey); }

/** Apple requires a JWT client secret signed with your .p8 key; valid at most 6 months, we mint one per request for 10 minutes. */
export async function appleClientSecret(env: AuthEnv, ttlSeconds = 600): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: env.appleKeyId, typ: "JWT" };
  const payload = { iss: env.appleTeamId, iat: now, exp: now + ttlSeconds, aud: APPLE_ISS, sub: env.appleClientId };
  const enc = (o: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const input = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(env.applePrivateKey!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  return base64UrlToBytes(body.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")).buffer;
}

export function appleAuthorizeUrl(env: AuthEnv, redirectUri: string, state: string): string {
  const url = new URL(`${APPLE_ISS}/auth/authorize`);
  url.searchParams.set("client_id", env.appleClientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAppleCode(env: AuthEnv, code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<string> {
  const res = await fetcher(`${APPLE_ISS}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.appleClientId!, client_secret: await appleClientSecret(env), code, grant_type: "authorization_code", redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error("apple_token_exchange_failed");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("apple_token_exchange_failed");
  return id_token;
}

type Jwk = JsonWebKey & { kid: string };
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function appleJwk(kid: string, fetcher: typeof fetch): Promise<Jwk> {
  if (!jwksCache || Date.now() - jwksCache.fetchedAt > 6 * 3600_000 || !jwksCache.keys.some((k) => k.kid === kid)) {
    const res = await fetcher(`${APPLE_ISS}/auth/keys`);
    if (!res.ok) throw new Error("apple_jwks_unavailable");
    jwksCache = { keys: ((await res.json()) as { keys: Jwk[] }).keys, fetchedAt: Date.now() };
  }
  const key = jwksCache.keys.find((k) => k.kid === kid);
  if (!key) throw new Error("apple_jwks_kid_unknown");
  return key;
}

/**
 * Verify an Apple ID token. `audiences` are the accepted client ids: the Services ID for web and the
 * app bundle ids for native sign-in. Email is only present the first time a user authorises the app,
 * and may be a private relay address.
 */
export async function verifyAppleIdToken(env: AuthEnv, idToken: string, fetcher: typeof fetch = fetch): Promise<AppleProfile> {
  const [headerB64] = idToken.split(".");
  const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64 ?? ""))) as { kid?: string; alg?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("apple_id_token_invalid");
  const jwk = await appleJwk(header.kid, fetcher);
  const payload = await verify(idToken, jwk, "RS256").catch(() => { throw new Error("apple_id_token_invalid"); });
  const audiences = [env.appleClientId, ...(env.appleBundleIds ?? [])].filter(Boolean);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== APPLE_ISS || !aud.some((a) => audiences.includes(a as string))) throw new Error("apple_id_token_wrong_audience");
  if (typeof payload.sub !== "string") throw new Error("apple_id_token_invalid");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  return { subject: payload.sub, email, emailVerified: email !== null && (payload.email_verified === true || payload.email_verified === "true"), isPrivateEmail: payload.is_private_email === true || payload.is_private_email === "true", name: null };
}

/** Apple sends `user` as JSON only on the first authorisation. */
export function appleNameFromUserJson(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } };
    return [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ").trim() || null;
  } catch { return null; }
}

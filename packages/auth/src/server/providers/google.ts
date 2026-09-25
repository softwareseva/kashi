/** Google sign-in with no SDK: web authorization-code flow with a signed state, and native ID-token verification. */
import { sign, verify } from "hono/jwt";
import type { AuthEnv } from "../types";

const STATE_TYP = "google_oauth_state";
export type OAuthState = { next: string; transport: "cookie" };
export type GoogleProfile = { subject: string; email: string | null; emailVerified: boolean; name: string | null };

export function googleConfigured(env: AuthEnv) { return Boolean(env.googleClientId && env.googleClientSecret); }

export async function signOAuthState(env: AuthEnv, state: OAuthState): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ typ: STATE_TYP, ...state, iss: env.issuer, aud: env.audience, iat: now, exp: now + 600 }, env.jwtSecret, "HS256");
}

export async function verifyOAuthState(env: AuthEnv, token: string): Promise<OAuthState | null> {
  try {
    const p = await verify(token, env.jwtSecret, { alg: "HS256", iss: env.issuer, aud: env.audience });
    return p.typ === STATE_TYP && typeof p.next === "string" ? { next: p.next, transport: "cookie" } : null;
  } catch { return null; }
}

/** Only relative paths without a scheme or `//` are accepted as post-login destinations. */
export const safeNext = (value: string | undefined, fallback = "/") => (value && /^\/(?!\/)[A-Za-z0-9/_\-.?=&%]{0,300}$/.test(value) ? value : fallback);

export function googleAuthorizeUrl(env: AuthEnv, redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.googleClientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(env: AuthEnv, code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<GoogleProfile> {
  const tokenRes = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.googleClientId!, client_secret: env.googleClientSecret!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) throw new Error("google_token_exchange_failed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("google_token_exchange_failed");
  const infoRes = await fetcher("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) throw new Error("google_userinfo_failed");
  return toProfile((await infoRes.json()) as RawProfile);
}

/** Verify an ID token minted by the native google_sign_in SDK (audience = the web client id used as serverClientId). */
export async function verifyGoogleIdToken(env: AuthEnv, idToken: string, fetcher: typeof fetch = fetch): Promise<GoogleProfile> {
  const res = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("google_id_token_invalid");
  const payload = (await res.json()) as RawProfile & { aud?: string };
  if (payload.aud !== env.googleClientId) throw new Error("google_id_token_wrong_audience");
  return toProfile(payload);
}

type RawProfile = { sub?: string; email?: string; email_verified?: string | boolean; name?: string; given_name?: string; family_name?: string };
function toProfile(p: RawProfile): GoogleProfile {
  if (!p.sub) throw new Error("google_profile_incomplete");
  const name = p.name?.trim() || [p.given_name, p.family_name].filter(Boolean).join(" ").trim() || null;
  return { subject: p.sub, email: p.email?.toLowerCase() ?? null, emailVerified: p.email_verified === true || p.email_verified === "true", name };
}

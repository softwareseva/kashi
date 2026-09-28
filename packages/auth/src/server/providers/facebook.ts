/** Facebook Login: web authorization-code flow with browser-bound state, and native access-token verification via the Graph API. */
import type { AuthEnv } from "../types";

const GRAPH_VERSION = "v21.0";
export type FacebookProfile = { subject: string; email: string | null; emailVerified: boolean; name: string | null };

export function facebookConfigured(env: AuthEnv) { return Boolean(env.facebookClientId && env.facebookClientSecret); }

export function facebookAuthorizeUrl(env: AuthEnv, redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", env.facebookClientId!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email public_profile");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeFacebookCode(env: AuthEnv, code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<FacebookProfile> {
  const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", env.facebookClientId!);
  tokenUrl.searchParams.set("client_secret", env.facebookClientSecret!);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetcher(tokenUrl.toString());
  if (!tokenRes.ok) throw new Error("facebook_token_exchange_failed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("facebook_token_exchange_failed");
  return fetchFacebookProfile(env, access_token, fetcher);
}

/** Verify the access token a native Facebook SDK login already produced, then read the profile. */
export async function verifyFacebookAccessToken(env: AuthEnv, accessToken: string, fetcher: typeof fetch = fetch): Promise<FacebookProfile> {
  const debugUrl = new URL(`https://graph.facebook.com/debug_token`);
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", `${env.facebookClientId}|${env.facebookClientSecret}`);
  const res = await fetcher(debugUrl.toString());
  if (!res.ok) throw new Error("facebook_access_token_invalid");
  const { data } = (await res.json()) as { data?: { app_id?: string; is_valid?: boolean } };
  if (!data?.is_valid || data.app_id !== env.facebookClientId) throw new Error("facebook_access_token_wrong_audience");
  return fetchFacebookProfile(env, accessToken, fetcher);
}

async function fetchFacebookProfile(env: AuthEnv, accessToken: string, fetcher: typeof fetch): Promise<FacebookProfile> {
  const infoUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`);
  infoUrl.searchParams.set("fields", "id,name,email");
  infoUrl.searchParams.set("access_token", accessToken);
  const infoRes = await fetcher(infoUrl.toString());
  if (!infoRes.ok) throw new Error("facebook_userinfo_failed");
  const raw = (await infoRes.json()) as { id?: string; name?: string; email?: string };
  if (!raw.id) throw new Error("facebook_profile_incomplete");
  // Facebook only returns `email` once the account's address is confirmed and the user granted the scope.
  return { subject: raw.id, email: raw.email?.toLowerCase() ?? null, emailVerified: Boolean(raw.email), name: raw.name?.trim() || null };
}

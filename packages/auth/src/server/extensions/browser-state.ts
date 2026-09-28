/**
 * Single-use OAuth/federation state bound to a host-only browser cookie: replaying a captured
 * `state` value alone (e.g. from a leaked redirect URL) isn't enough — the caller must also
 * present the matching browser cookie, and the challenge row is consumed exactly once.
 */
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { randomToken, sha256 } from "@softwareseva/core/server";
import { AuthStore } from "../store";
import type { AuthEnv } from "../types";

const cookieName = (env: AuthEnv, kind: string) => `${env.secureCookies ? "__Host-" : ""}auth-state-${kind}`;
/** `crossSite: true` is for callbacks the browser reaches via a cross-site navigation (e.g. Apple's `form_post`), which requires `SameSite=None; Secure` or the cookie never arrives. */
const cookieOptions = (env: AuthEnv, opts?: { crossSite?: boolean }): { httpOnly: true; secure: boolean; sameSite: "None" | "Lax"; path: string } => ({ httpOnly: true, secure: opts?.crossSite ? true : env.secureCookies, sameSite: opts?.crossSite ? "None" : "Lax", path: "/" });

export async function boundState(c: Context, env: AuthEnv, kind: string, data: object, opts?: { crossSite?: boolean }): Promise<string> {
  const browser = randomToken(32);
  const id = await new AuthStore(env.db).createChallenge(await sha256(browser), `browser:${kind}`, JSON.stringify(data), 600);
  setCookie(c, cookieName(env, kind), browser, { ...cookieOptions(env, opts), maxAge: 600 });
  return id;
}

export async function consumeBoundState<T>(c: Context, env: AuthEnv, kind: string, id: string, opts?: { crossSite?: boolean }): Promise<T | null> {
  const browser = getCookie(c, cookieName(env, kind));
  if (!browser) return null;
  deleteCookie(c, cookieName(env, kind), cookieOptions(env, opts));
  const value = await new AuthStore(env.db).consumeChallenge(id, `browser:${kind}`, await sha256(browser));
  return value ? (JSON.parse(value) as T) : null;
}

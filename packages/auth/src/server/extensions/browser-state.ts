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
const cookieOptions = (env: AuthEnv) => ({ httpOnly: true, secure: env.secureCookies, sameSite: "Lax" as const, path: "/" });

export async function boundState(c: Context, env: AuthEnv, kind: string, data: object): Promise<string> {
  const browser = randomToken(32);
  const id = await new AuthStore(env.db).createChallenge(await sha256(browser), `browser:${kind}`, JSON.stringify(data), 600);
  setCookie(c, cookieName(env, kind), browser, { ...cookieOptions(env), maxAge: 600 });
  return id;
}

export async function consumeBoundState<T>(c: Context, env: AuthEnv, kind: string, id: string): Promise<T | null> {
  const browser = getCookie(c, cookieName(env, kind));
  if (!browser) return null;
  deleteCookie(c, cookieName(env, kind), cookieOptions(env));
  const value = await new AuthStore(env.db).consumeChallenge(id, `browser:${kind}`, await sha256(browser));
  return value ? (JSON.parse(value) as T) : null;
}

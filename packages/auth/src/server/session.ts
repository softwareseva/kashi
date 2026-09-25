/** Access JWTs, rotating refresh-token families, cookie/bearer transport, and the auth middleware. */
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { ApiError, futureIso, nowIso, randomToken } from "@softwareseva/core/server";
import { resolveEnv } from "./env";
import { AuthStore } from "./store";
import type { AuthConfig, AuthEnv, AuthUser, AuthVariables, SessionPair, Transport } from "./types";

export const DEFAULT_ACCESS_TTL = 15 * 60;
export const DEFAULT_REFRESH_TTL = 30 * 24 * 3600;

export type AccessClaims = { sub: string; name: string; roles: string[]; iss: string; aud: string; iat: number; exp: number };

const cookieNames = (config: AuthConfig, env: AuthEnv) => ({
  access: config.cookieNames?.access ?? (env.secureCookies ? "__Host-access" : "access"),
  refresh: config.cookieNames?.refresh ?? (env.secureCookies ? "__Host-refresh" : "refresh"),
});
const cookieOptions = (env: AuthEnv) => ({ httpOnly: true, secure: env.secureCookies, sameSite: "Lax" as const, path: "/" });

export async function signAccessToken(config: AuthConfig, env: AuthEnv, user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: AccessClaims = { sub: user.id, name: user.name, roles: user.roles, iss: env.issuer, aud: env.audience, iat: now, exp: now + (config.accessTtlSeconds ?? DEFAULT_ACCESS_TTL) };
  return sign(claims, env.jwtSecret, "HS256");
}

export async function verifyAccessToken(env: AuthEnv, token: string): Promise<AccessClaims | null> {
  try {
    const payload = await verify(token, env.jwtSecret, { alg: "HS256", iss: env.issuer, aud: env.audience });
    return typeof payload.sub === "string" ? (payload as unknown as AccessClaims) : null;
  } catch {
    return null;
  }
}

/** Mint an access token and persist a refresh session. Transport-agnostic. */
export async function issueTokenPair(config: AuthConfig, env: AuthEnv, user: AuthUser, familyId: string = crypto.randomUUID(), deviceName: string | null = null): Promise<SessionPair> {
  const accessToken = await signAccessToken(config, env, user);
  const refreshToken = randomToken(48);
  await new AuthStore(env.db).createRefresh(user.id, familyId, refreshToken, futureIso(config.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL), deviceName);
  return { accessToken, refreshToken, expiresIn: config.accessTtlSeconds ?? DEFAULT_ACCESS_TTL, familyId };
}

/**
 * Validate a raw refresh token, mark it rotated, and revoke the whole family on reuse.
 * Returns the user and family so the caller can issue the next pair on the same family.
 */
export async function rotateRefreshToken(env: AuthEnv, raw: string): Promise<{ user: AuthUser; familyId: string }> {
  const store = new AuthStore(env.db);
  const session = await store.findRefresh(raw);
  const invalid = () => new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  if (!session || session.revoked_at || session.expires_at <= nowIso()) throw invalid();
  if (session.rotated_at || !(await store.markRotated(session.id))) {
    await store.revokeFamily(session.family_id);
    throw new ApiError(401, "TOKEN_REUSE", "Session reuse was detected; please sign in again.");
  }
  const user = await store.userById(session.user_id);
  if (!user) throw invalid();
  return { user, familyId: session.family_id };
}

/** Issue a session in the requested transport: cookies for browsers, a token pair for native apps. */
export async function issueSession(c: Context, config: AuthConfig, env: AuthEnv, user: AuthUser, transport: Transport, familyId?: string, deviceName?: string | null) {
  const pair = await issueTokenPair(config, env, user, familyId, deviceName ?? null);
  if (transport === "token") return { user, accessToken: pair.accessToken, refreshToken: pair.refreshToken, expiresIn: pair.expiresIn };
  const names = cookieNames(config, env);
  setCookie(c, names.access, pair.accessToken, { ...cookieOptions(env), maxAge: pair.expiresIn });
  setCookie(c, names.refresh, pair.refreshToken, { ...cookieOptions(env), maxAge: config.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL });
  return { user };
}

export function clearSessionCookies(c: Context, config: AuthConfig, env: AuthEnv) {
  const names = cookieNames(config, env);
  deleteCookie(c, names.access, cookieOptions(env));
  deleteCookie(c, names.refresh, cookieOptions(env));
}

export const readRefreshCookie = (c: Context, config: AuthConfig, env: AuthEnv) => getCookie(c, cookieNames(config, env).refresh);

const bearer = (c: Context) => { const h = c.req.header("Authorization"); return h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null; };

/** Origin check for cookie-authenticated state-changing requests (CSRF). */
function assertSameOrigin(c: Context, env: AuthEnv) {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return;
  const origin = c.req.header("Origin") ?? (c.req.header("Referer") ? new URL(c.req.header("Referer")!).origin : null);
  const fetchSite = c.req.header("Sec-Fetch-Site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  if (!origin || !env.origins.includes(origin)) throw new ApiError(403, "FORBIDDEN", "Cross-site request rejected.");
}

/**
 * Require a signed-in user. Accepts a bearer token or the access cookie; cookie sessions on non-GET
 * requests must come from an allowed origin. Sets `c.get("user")` and `c.get("sessionTransport")`.
 */
export function requireAuth(config: AuthConfig): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const env = resolveEnv(config, c.env as Record<string, unknown>);
    let token = bearer(c); let transport: Transport = "token";
    if (!token) { token = getCookie(c, cookieNames(config, env).access) ?? null; transport = "cookie"; }
    const claims = token ? await verifyAccessToken(env, token) : null;
    if (!claims) throw new ApiError(401, "UNAUTHORIZED", "Please sign in.");
    if (transport === "cookie") assertSameOrigin(c, env);
    const user = await new AuthStore(env.db).userById(claims.sub);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Your account is no longer active.");
    c.set("user", user);
    c.set("sessionTransport", transport);
    await next();
  };
}

/** Like requireAuth but continues anonymously when no valid session is present. */
export function optionalAuth(config: AuthConfig): MiddlewareHandler<{ Variables: Partial<AuthVariables> }> {
  const strict = requireAuth(config);
  return async (c, next) => {
    try { await strict(c as never, async () => {}); } catch { /* anonymous */ }
    await next();
  };
}

/** Require any of the given roles (after requireAuth). */
export function requireRole(config: AuthConfig, ...roles: string[]): MiddlewareHandler<{ Variables: AuthVariables }> {
  const auth = requireAuth(config);
  return async (c, next) => {
    await auth(c, async () => {
      if (!c.get("user").roles.some((r) => roles.includes(r))) throw new ApiError(403, "FORBIDDEN", "You do not have access to this resource.");
      await next();
    });
  };
}

/** Run hooks and issue the session; every provider ends here. */
export async function completeSignIn(c: Context, config: AuthConfig, env: AuthEnv, user: AuthUser, provider: string, transport: Transport, deviceName?: string | null) {
  const adjusted = (await config.hooks?.beforeSession?.(user, provider, c)) ?? user;
  await config.hooks?.onSignIn?.(adjusted, provider, c);
  return issueSession(c, config, env, adjusted, transport, undefined, deviceName);
}

/** Hashed, single-use recovery codes, plus `requireRecent`: a freshness gate for sensitive changes. */
import { Hono } from "hono";
import { z } from "zod";
import { ok, randomToken, ApiError, consumeRateLimit, clientIp, sha256 } from "@softwareseva/core/server";
import { getCookie } from "hono/cookie";
import { requireAuth, completeSignIn, verifyAccessToken, bearer } from "../session";
import { resolveEnv } from "../env";
import { AuthStore } from "../store";
import { ExtensionStore } from "./store";
import type { AuthConfig, AuthVariables, AuthEnv } from "../types";
import type { Context } from "hono";

/**
 * Require that the current session's family began recently (default: 5 minutes) before allowing
 * a sensitive change (issuing recovery codes, linking a contact or identity). This isn't a
 * step-up re-auth prompt — it just checks how long ago the caller last went through a sign-in
 * flow that started this refresh-token family.
 */
export async function requireRecent(c: Context, env: AuthEnv, config: AuthConfig) {
  const token = bearer(c) ?? getCookie(c, config.cookieNames?.access ?? (env.secureCookies ? "__Host-access" : "access"));
  const claims = token ? await verifyAccessToken(env, token) : null;
  const issued = claims?.sid ? await new ExtensionStore(env.db).familyIssued(claims.sub, claims.sid) : null;
  if (!issued?.created_at || Date.now() - Date.parse(issued.created_at) > 300_000)
    throw new ApiError(403, "REAUTH_REQUIRED", "Sign in again before changing authentication methods.");
}

export function recoveryRouter(config: AuthConfig) {
  const app = new Hono<{ Bindings: Record<string, unknown>; Variables: AuthVariables }>();
  app.post("/recovery/codes", requireAuth(config), async (c) => {
    const env = resolveEnv(config, c.env);
    await requireRecent(c, env, config);
    const codes = Array.from({ length: 10 }, () => randomToken(18));
    await new ExtensionStore(env.db).replaceRecovery(c.get("user").id, codes);
    return ok(c, { codes });
  });
  app.post("/recovery/sign-in", async (c) => {
    const env = resolveEnv(config, c.env);
    const { code } = z.object({ code: z.string().min(10).max(100) }).parse(await c.req.json());
    await consumeRateLimit(env.db, `recovery:${await sha256(clientIp(c))}`, 5, 600);
    const userId = await new ExtensionStore(env.db).consumeRecovery(code);
    const user = userId ? await new AuthStore(env.db).userById(userId) : null;
    if (!user) throw new ApiError(401, "INVALID_CODE", "Invalid recovery code.");
    return ok(c, await completeSignIn(c, config, env, user, "recovery", "cookie"));
  });
  return app;
}

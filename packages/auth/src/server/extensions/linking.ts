/** Authenticated Google linking: keeps the signed-in account and rejects identity collisions. */
import { Hono } from "hono";
import { ApiError } from "@softwareseva/core/server";
import { requireAuth } from "../session";
import { requireRecent } from "./recovery";
import { boundState, consumeBoundState } from "./browser-state";
import { resolveEnv } from "../env";
import { googleConfigured, googleAuthorizeUrl, exchangeGoogleCode, safeNext } from "../providers/google";
import { AuthStore } from "../store";
import { ExtensionStore } from "./store";
import type { AuthConfig, AuthVariables } from "../types";

export function linkingRouter(config: AuthConfig) {
  const app = new Hono<{ Bindings: Record<string, unknown>; Variables: AuthVariables }>();
  const auth = requireAuth(config);
  app.get("/google/link/start", auth, async (c) => {
    const env = resolveEnv(config, c.env);
    await requireRecent(c, env, config);
    if (!googleConfigured(env)) throw new ApiError(503, "PROVIDER_DISABLED", "Google is unavailable.");
    const state = await boundState(c, env, "google-link", { userId: c.get("user").id, next: safeNext(c.req.query("next")) });
    return c.redirect(googleAuthorizeUrl(env, `${env.authUrl}/google/link/callback`, state));
  });
  app.get("/google/link/callback", auth, async (c) => {
    const env = resolveEnv(config, c.env);
    const fail = (code: string) => c.redirect(`${env.appOrigin}/?tab=security&error=${code}`);
    const state = await consumeBoundState<{ userId: string; next: string }>(c, env, "google-link", c.req.query("state") ?? "");
    if (!state || state.userId !== c.get("user").id) return fail("OAUTH_STATE_INVALID");
    const code = c.req.query("code");
    if (!code) return fail("OAUTH_FAILED");
    const profile = await exchangeGoogleCode(env, code, `${env.authUrl}/google/link/callback`).catch(() => null);
    if (!profile) return fail("OAUTH_FAILED");
    const auth = new AuthStore(env.db);
    const ext = new ExtensionStore(env.db);
    const owner = await auth.userByIdentity("google", profile.subject);
    const emailOwner = profile.email && profile.emailVerified ? await auth.userByEmail(profile.email) : null;
    const aliasOwner = profile.email && profile.emailVerified ? await ext.contactOwner("email", profile.email) : null;
    if ((aliasOwner && aliasOwner !== state.userId) || (owner && owner.user.id !== state.userId) || (emailOwner && emailOwner.user.id !== state.userId))
      return fail("ACCOUNT_MERGE_REQUIRED");
    if (!owner) await ext.linkGoogle(state.userId, profile.subject, profile.email, profile.emailVerified);
    return c.redirect(`${env.appOrigin}${state.next || "/?tab=security"}`);
  });
  return app;
}

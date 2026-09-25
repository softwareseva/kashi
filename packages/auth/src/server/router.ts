/** authRouter(config): every sign-in method, session refresh and sign-out as one mountable Hono sub-app. */
import { Hono, type Context } from "hono";
import { z } from "zod";
import { ApiError, ok } from "@kashi/core/server";
import { resolveEnv } from "./env";
import { changePassword, passwordChangeSchema, passwordSignInSchema, authenticatePassword, normalizeIdentifier } from "./providers/password";
import { otpRequestSchema, otpVerifySchema, requestOtp, verifyOtp } from "./providers/otp";
import { exchangeGoogleCode, googleAuthorizeUrl, googleConfigured, safeNext, signOAuthState, verifyGoogleIdToken, verifyOAuthState } from "./providers/google";
import { appleAuthorizeUrl, appleConfigured, appleNameFromUserJson, exchangeAppleCode, verifyAppleIdToken } from "./providers/apple";
import { authenticationOptions, passkeyAuthVerifySchema, passkeyRegisterVerifySchema, passkeyRenameSchema, registrationOptions, verifyAuthentication, verifyRegistration } from "./providers/passkeys";
import { clearSessionCookies, completeSignIn, issueSession, readRefreshCookie, requireAuth, rotateRefreshToken } from "./session";
import { AuthStore } from "./store";
import { userForIdentity } from "./users";
import type { AuthConfig, AuthEnv, AuthVariables } from "./types";

type Env = { Bindings: Record<string, unknown>; Variables: AuthVariables & { requestId?: string } };
const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
const idTokenBody = z.object({ idToken: z.string().min(20), transport: z.enum(["cookie", "token"]).default("token"), deviceName: z.string().max(80).optional() });
const appleTokenBody = idTokenBody.extend({ name: z.string().trim().max(120).optional() });

/**
 * Mount with `app.route("/v1/auth", authRouter(config))`. Routes (all under the mount path):
 *
 * - `GET /config` enabled providers · `GET /me` · `POST /refresh` (cookie) · `POST /logout` · `POST /logout-all`
 * - `POST /token/refresh` · `POST /token/revoke` (bearer transport, bodies carry the refresh token)
 * - `POST /password/sign-in` · `POST /password/change`
 * - `POST /otp/request` · `POST /otp/verify`
 * - `GET /google/start?next=` · `GET /google/callback` · `POST /google/token`
 * - `GET /apple/start?next=` · `POST /apple/callback` · `POST /apple/token`
 * - `POST /passkeys/register/options` · `POST /passkeys/register/verify` · `GET /passkeys` · `PATCH /passkeys/:id` · `DELETE /passkeys/:id`
 * - `POST /passkeys/authenticate/options` · `POST /passkeys/authenticate/verify`
 */
export function authRouter(config: AuthConfig): Hono<Env> {
  const app = new Hono<Env>();
  const env = (c: Context<Env>) => resolveEnv(config, c.env);
  const auth = requireAuth(config);
  const p = config.providers;

  app.get("/config", (c) => {
    const e = env(c);
    return ok(c, { providers: { password: Boolean(p.password), otp: p.otp ? { channel: p.otp.channel } : null, google: Boolean(p.google) && googleConfigured(e), apple: Boolean(p.apple) && appleConfigured(e), passkeys: Boolean(p.passkeys) } });
  });
  app.get("/me", auth, (c) => ok(c, { user: c.get("user") }));

  // ----- sessions -----
  app.post("/refresh", async (c) => {
    const e = env(c);
    const raw = readRefreshCookie(c, config, e);
    if (!raw) throw new ApiError(401, "UNAUTHORIZED", "No session to refresh.");
    try {
      const { user, familyId } = await rotateRefreshToken(e, raw);
      return ok(c, await issueSession(c, config, e, user, "cookie", familyId));
    } catch (error) {
      if (error instanceof ApiError && error.code === "TOKEN_REUSE") clearSessionCookies(c, config, e);
      throw error;
    }
  });
  app.post("/logout", async (c) => {
    const e = env(c);
    const raw = readRefreshCookie(c, config, e);
    if (raw) await new AuthStore(e.db).revokeByToken(raw);
    clearSessionCookies(c, config, e);
    return ok(c, { signedOut: true });
  });
  app.post("/logout-all", auth, async (c) => {
    const e = env(c);
    await new AuthStore(e.db).revokeAllForUser(c.get("user").id);
    if (c.get("sessionTransport") === "cookie") clearSessionCookies(c, config, e);
    return ok(c, { signedOut: true });
  });
  app.post("/token/refresh", async (c) => {
    const e = env(c);
    const { refreshToken } = refreshBody.parse(await c.req.json());
    const { user, familyId } = await rotateRefreshToken(e, refreshToken);
    return ok(c, await issueSession(c, config, e, user, "token", familyId));
  });
  app.post("/token/revoke", async (c) => {
    const e = env(c);
    await new AuthStore(e.db).revokeByToken(refreshBody.parse(await c.req.json()).refreshToken);
    return ok(c, { signedOut: true });
  });

  // ----- password -----
  if (p.password) {
    app.post("/password/sign-in", async (c) => {
      const e = env(c);
      const input = passwordSignInSchema.parse(await c.req.json());
      const user = await authenticatePassword(c, e, normalizeIdentifier(input.identifier, p.otp?.defaultCountry), input.password);
      return ok(c, await completeSignIn(c, config, e, user, "password", input.transport, input.deviceName));
    });
    app.post("/password/change", auth, async (c) => {
      await changePassword(env(c), config, c.get("user"), passwordChangeSchema.parse(await c.req.json()));
      return ok(c, { changed: true });
    });
  }

  // ----- one-time codes -----
  if (p.otp) {
    app.post("/otp/request", async (c) => {
      await requestOtp(c, config, env(c), otpRequestSchema.parse(await c.req.json()).destination);
      return ok(c, { sent: true });
    });
    app.post("/otp/verify", async (c) => {
      const e = env(c);
      const input = otpVerifySchema.parse(await c.req.json());
      const user = await verifyOtp(c, config, e, input);
      return ok(c, await completeSignIn(c, config, e, user, "otp", input.transport, input.deviceName));
    });
  }

  // ----- google -----
  if (p.google) {
    const redirectUri = (e: AuthEnv) => `${e.authUrl}/google/callback`;
    app.get("/google/start", async (c) => {
      const e = env(c);
      if (!googleConfigured(e)) throw new ApiError(503, "PROVIDER_DISABLED", "Google sign-in is not configured.");
      if (!e.authUrl) throw new Error("@kashi/auth: AUTH_URL must be the public URL of this router, e.g. https://api.example.com/v1/auth");
      const state = await signOAuthState(e, { next: safeNext(c.req.query("next")), transport: "cookie" });
      return c.redirect(googleAuthorizeUrl(e, redirectUri(e), state));
    });
    app.get("/google/callback", async (c) => {
      const e = env(c);
      const fail = (code: string) => c.redirect(`${e.appOrigin}/sign-in?error=${code}`);
      const state = await verifyOAuthState(e, c.req.query("state") ?? "");
      if (!state) return fail("OAUTH_STATE_INVALID");
      if (c.req.query("error")) return fail("OAUTH_CANCELLED");
      const code = c.req.query("code");
      if (!code) return fail("OAUTH_FAILED");
      try {
        const profile = await exchangeGoogleCode(e, code, redirectUri(e));
        const user = await userForIdentity(c, config, e, "google", profile, p.google!.allowSignUp !== false);
        await completeSignIn(c, config, e, user, "google", "cookie");
        return c.redirect(`${e.appOrigin}${state.next}`);
      } catch (error) {
        return fail(error instanceof ApiError ? error.code : "OAUTH_FAILED");
      }
    });
    app.post("/google/token", async (c) => {
      const e = env(c);
      const input = idTokenBody.parse(await c.req.json());
      const profile = await verifyGoogleIdToken(e, input.idToken).catch(() => { throw new ApiError(401, "OAUTH_FAILED", "Google sign-in could not be verified."); });
      const user = await userForIdentity(c, config, e, "google", profile, p.google!.allowSignUp !== false);
      return ok(c, await completeSignIn(c, config, e, user, "google", input.transport, input.deviceName));
    });
  }

  // ----- apple -----
  if (p.apple) {
    const redirectUri = (e: AuthEnv) => `${e.authUrl}/apple/callback`;
    app.get("/apple/start", async (c) => {
      const e = env(c);
      if (!appleConfigured(e)) throw new ApiError(503, "PROVIDER_DISABLED", "Sign in with Apple is not configured.");
      if (!e.authUrl) throw new Error("@kashi/auth: AUTH_URL must be the public URL of this router.");
      const state = await signOAuthState(e, { next: safeNext(c.req.query("next")), transport: "cookie" });
      return c.redirect(appleAuthorizeUrl(e, redirectUri(e), state));
    });
    // Apple posts a form (response_mode=form_post); the browser lands here cross-site, so the session cookie must be SameSite=Lax and set on this response.
    app.post("/apple/callback", async (c) => {
      const e = env(c);
      const fail = (code: string) => c.redirect(`${e.appOrigin}/sign-in?error=${code}`);
      const form = await c.req.parseBody();
      const state = await verifyOAuthState(e, String(form.state ?? ""));
      if (!state) return fail("OAUTH_STATE_INVALID");
      if (form.error) return fail("OAUTH_CANCELLED");
      const code = typeof form.code === "string" ? form.code : null;
      if (!code) return fail("OAUTH_FAILED");
      try {
        const idToken = await exchangeAppleCode(e, code, redirectUri(e));
        const profile = await verifyAppleIdToken(e, idToken);
        profile.name = appleNameFromUserJson(typeof form.user === "string" ? form.user : undefined);
        const user = await userForIdentity(c, config, e, "apple", profile, p.apple!.allowSignUp !== false);
        await completeSignIn(c, config, e, user, "apple", "cookie");
        return c.redirect(`${e.appOrigin}${state.next}`);
      } catch (error) {
        return fail(error instanceof ApiError ? error.code : "OAUTH_FAILED");
      }
    });
    app.post("/apple/token", async (c) => {
      const e = env(c);
      const input = appleTokenBody.parse(await c.req.json());
      const profile = await verifyAppleIdToken(e, input.idToken).catch(() => { throw new ApiError(401, "OAUTH_FAILED", "Apple sign-in could not be verified."); });
      profile.name = input.name ?? null;
      const user = await userForIdentity(c, config, e, "apple", profile, p.apple!.allowSignUp !== false);
      return ok(c, await completeSignIn(c, config, e, user, "apple", input.transport, input.deviceName));
    });
  }

  // ----- passkeys -----
  if (p.passkeys) {
    app.post("/passkeys/register/options", auth, async (c) => ok(c, await registrationOptions(config, env(c), c.get("user"))));
    app.post("/passkeys/register/verify", auth, async (c) => ok(c, await verifyRegistration(config, env(c), c.get("user"), passkeyRegisterVerifySchema.parse(await c.req.json())), 201));
    app.get("/passkeys", auth, async (c) => {
      const rows = (await new AuthStore(env(c).db).listPasskeys(c.get("user").id)).results;
      return ok(c, { items: rows.map((r) => ({ id: r.id, deviceName: r.device_name, backedUp: r.backed_up === 1, createdAt: r.created_at, lastUsedAt: r.last_used_at })) });
    });
    app.patch("/passkeys/:id", auth, async (c) => {
      const okRename = await new AuthStore(env(c).db).renamePasskey(c.req.param("id"), c.get("user").id, passkeyRenameSchema.parse(await c.req.json()).deviceName);
      if (!okRename) throw new ApiError(404, "NOT_FOUND", "Passkey not found.");
      return ok(c, { updated: true });
    });
    app.delete("/passkeys/:id", auth, async (c) => {
      const store = new AuthStore(env(c).db);
      const removed = await store.removePasskey(c.req.param("id"), c.get("user").id);
      if (!removed) throw new ApiError(404, "NOT_FOUND", "Passkey not found.");
      return ok(c, { removed: true });
    });
    app.post("/passkeys/authenticate/options", async (c) => ok(c, await authenticationOptions(c, config, env(c))));
    app.post("/passkeys/authenticate/verify", async (c) => {
      const e = env(c);
      const input = passkeyAuthVerifySchema.parse(await c.req.json());
      const user = await verifyAuthentication(config, e, input);
      return ok(c, await completeSignIn(c, config, e, user, "passkey", input.transport, input.deviceName));
    });
  }

  return app;
}

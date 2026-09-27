/** authRouter(config): every sign-in method, session refresh and sign-out as one mountable Hono sub-app. */
import { Hono, type Context } from "hono";
import { z } from "zod";
import { ApiError, newId, ok, randomToken, rateLimit, safeEqual, sha256Hex } from "@softwareseva/core/server";
import { resolveEnv } from "./env";
import { changePassword, passwordChangeSchema, passwordSignInSchema, authenticatePassword, normalizeIdentifier } from "./providers/password";
import { otpRequestSchema, otpVerifySchema, requestOtp, verifyOtp } from "./providers/otp";
import { exchangeGoogleCode, googleAuthorizeUrl, googleConfigured, safeNext, signOAuthState, verifyGoogleIdToken, verifyOAuthState } from "./providers/google";
import { appleAuthorizeUrl, appleConfigured, appleNameFromUserJson, exchangeAppleCode, verifyAppleIdToken } from "./providers/apple";
import { exchangeFacebookCode, facebookAuthorizeUrl, facebookConfigured, verifyFacebookAccessToken, signOAuthState as signFacebookState, verifyOAuthState as verifyFacebookState } from "./providers/facebook";
import { anonymousRegistrationOptions, authenticationOptions, passkeySignupVerifySchema, passkeyAuthVerifySchema, passkeyRegisterVerifySchema, passkeyRenameSchema, registrationOptions, verifyAnonymousRegistration, verifyAuthentication, verifyRegistration } from "./providers/passkeys";
import { federationJwks, peerIssuerConfigured, signFederationIdToken } from "./providers/peer-issuer";
import { exchangePeerCode, peerAuthorizeUrl, signPeerState, verifyPeerState } from "./providers/peer-consumer";
import { clearSessionCookies, completeSignIn, issueSession, readRefreshCookie, requireAuth, requireRole, rotateRefreshToken } from "./session";
import { AuthStore } from "./store";
import { userForIdentity } from "./users";
import type { AuthConfig, AuthEnv, AuthVariables, PeerTrustConfig } from "./types";

type Env = { Bindings: Record<string, unknown>; Variables: AuthVariables & { requestId?: string } };
const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
const idTokenBody = z.object({ idToken: z.string().min(20), transport: z.enum(["cookie", "token"]).default("token"), deviceName: z.string().max(80).optional() });
const appleTokenBody = idTokenBody.extend({ name: z.string().trim().max(120).optional() });
const facebookTokenBody = z.object({ accessToken: z.string().min(20), transport: z.enum(["cookie", "token"]).default("token"), deviceName: z.string().max(80).optional() });
const federationRegisterBody = z.object({ siteName: z.string().trim().min(1).max(120), redirectUri: z.string().url() });
const federationTokenBody = z.object({ grant_type: z.literal("authorization_code"), code: z.string().min(20), clientId: z.string().min(1), clientSecret: z.string().min(1), redirectUri: z.string().url() });
const peerTokenBody = z.object({ key: z.string().min(1), code: z.string().min(1), transport: z.enum(["cookie", "token"]).default("token"), deviceName: z.string().max(80).optional() });

/**
 * Mount with `app.route("/v1/auth", authRouter(config))`. Routes (all under the mount path):
 *
 * - `GET /config` enabled providers · `GET /me` · `POST /refresh` (cookie) · `POST /logout` · `POST /logout-all`
 * - `POST /token/refresh` · `POST /token/revoke` (bearer transport, bodies carry the refresh token)
 * - `POST /password/sign-in` · `POST /password/change`
 * - `POST /otp/request` · `POST /otp/verify`
 * - `GET /google/start?next=` · `GET /google/callback` · `POST /google/token`
 * - `GET /apple/start?next=` · `POST /apple/callback` · `POST /apple/token`
 * - `GET /facebook/start?next=` · `GET /facebook/callback` · `POST /facebook/token`
 * - `POST /passkeys/register/options` · `POST /passkeys/register/verify` · `GET /passkeys` · `PATCH /passkeys/:id` · `DELETE /passkeys/:id`
 * - `POST /passkeys/authenticate/options` · `POST /passkeys/authenticate/verify`
 * - `POST /passkeys/signup/options` · `POST /passkeys/signup/verify` (contact-free: no sign-in required, account is created only once the passkey verifies)
 * - Peer issuer (this site lets other kashi sites sign their users in here): `POST /federation/clients/register` ·
 *   `GET /federation/clients` · `POST /federation/clients/:id/approve` (admin) · `POST /federation/clients/:id/rotate` (admin) ·
 *   `POST /federation/clients/:id/revoke` (admin) · `GET /federation/authorize?client_id=&redirect_uri=&state=` ·
 *   `POST /federation/token` · `GET /federation/.well-known/jwks.json`
 * - Peer consumer (this site trusts another kashi site's accounts): `GET /peer/:key/start?next=` · `GET /peer/callback` · `POST /peer/token`
 */
export function authRouter(config: AuthConfig): Hono<Env> {
  const app = new Hono<Env>();
  const env = (c: Context<Env>) => resolveEnv(config, c.env);
  const auth = requireAuth(config);
  const p = config.providers;

  app.get("/config", (c) => {
    const e = env(c);
    const peers = (p.peer?.trust ?? []).map((t, i) => ({ key: String(i), label: t.label ?? new URL(t.issuer).host }));
    return ok(c, { providers: { password: Boolean(p.password), otp: p.otp ? { channel: p.otp.channel } : null, google: Boolean(p.google) && googleConfigured(e), apple: Boolean(p.apple) && appleConfigured(e), facebook: Boolean(p.facebook) && facebookConfigured(e), passkeys: Boolean(p.passkeys), passkeySignUp: Boolean(p.passkeys) && p.passkeys?.allowSignUp !== false, peer: peers } });
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
      if (!e.authUrl) throw new Error("@softwareseva/auth: AUTH_URL must be the public URL of this router, e.g. https://api.example.com/v1/auth");
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
      if (!e.authUrl) throw new Error("@softwareseva/auth: AUTH_URL must be the public URL of this router.");
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

  // ----- facebook -----
  if (p.facebook) {
    const redirectUri = (e: AuthEnv) => `${e.authUrl}/facebook/callback`;
    app.get("/facebook/start", async (c) => {
      const e = env(c);
      if (!facebookConfigured(e)) throw new ApiError(503, "PROVIDER_DISABLED", "Facebook sign-in is not configured.");
      if (!e.authUrl) throw new Error("@softwareseva/auth: AUTH_URL must be the public URL of this router, e.g. https://api.example.com/v1/auth");
      const state = await signFacebookState(e, { next: safeNext(c.req.query("next")), transport: "cookie" });
      return c.redirect(facebookAuthorizeUrl(e, redirectUri(e), state));
    });
    app.get("/facebook/callback", async (c) => {
      const e = env(c);
      const fail = (code: string) => c.redirect(`${e.appOrigin}/sign-in?error=${code}`);
      const state = await verifyFacebookState(e, c.req.query("state") ?? "");
      if (!state) return fail("OAUTH_STATE_INVALID");
      if (c.req.query("error")) return fail("OAUTH_CANCELLED");
      const code = c.req.query("code");
      if (!code) return fail("OAUTH_FAILED");
      try {
        const profile = await exchangeFacebookCode(e, code, redirectUri(e));
        const user = await userForIdentity(c, config, e, "facebook", profile, p.facebook!.allowSignUp !== false);
        await completeSignIn(c, config, e, user, "facebook", "cookie");
        return c.redirect(`${e.appOrigin}${state.next}`);
      } catch (error) {
        return fail(error instanceof ApiError ? error.code : "OAUTH_FAILED");
      }
    });
    app.post("/facebook/token", async (c) => {
      const e = env(c);
      const input = facebookTokenBody.parse(await c.req.json());
      const profile = await verifyFacebookAccessToken(e, input.accessToken).catch(() => { throw new ApiError(401, "OAUTH_FAILED", "Facebook sign-in could not be verified."); });
      const user = await userForIdentity(c, config, e, "facebook", profile, p.facebook!.allowSignUp !== false);
      return ok(c, await completeSignIn(c, config, e, user, "facebook", input.transport, input.deviceName));
    });
  }

  // ----- passkeys -----
  if (p.passkeys) {
    app.post("/passkeys/register/options", auth, async (c) => ok(c, await registrationOptions(config, env(c), c.get("user"))));
    app.post("/passkeys/register/verify", auth, async (c) => ok(c, await verifyRegistration(config, env(c), c.get("user"), passkeyRegisterVerifySchema.parse(await c.req.json())), 201));
    app.get("/passkeys", auth, async (c) => {
      const rows = (await new AuthStore(env(c).db).listPasskeys(c.get("user").id)).results;
      return ok(c, { items: rows.map((r) => ({ id: r.id, deviceName: r.device_name, backedUp: r.backed_up === 1, rpId: r.rp_id, createdAt: r.created_at, lastUsedAt: r.last_used_at })) });
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

    // Contact-free account creation: no auth, no email/phone/OAuth — the account exists only
    // once the new passkey has verified. This is the default sign-up path; gate with
    // `providers.passkeys.allowSignUp = false` to require OTP/OAuth sign-up instead.
    if (p.passkeys.allowSignUp !== false) {
      app.post("/passkeys/signup/options", async (c) => ok(c, await anonymousRegistrationOptions(config, env(c))));
      app.post("/passkeys/signup/verify", async (c) => {
        const e = env(c);
        const input = passkeySignupVerifySchema.parse(await c.req.json());
        const user = await verifyAnonymousRegistration(c, config, e, input);
        return ok(c, await completeSignIn(c, config, e, user, "passkey", input.transport, input.deviceName), 201);
      });
    }
  }

  // ----- peer issuer: let other kashi sites register and sign their users in here -----
  if (p.peer?.issuer?.enabled) {
    const admin = requireRole(config, "admin");
    app.post("/federation/clients/register", rateLimit({ scope: "federation-register", limit: 10, windowSeconds: 3600 }), async (c) => {
      const e = env(c);
      const input = federationRegisterBody.parse(await c.req.json());
      const client = await new AuthStore(e.db).createFederationClient(newId("fedcli"), input.siteName, input.redirectUri);
      return ok(c, { id: client.id, clientId: client.client_id, status: client.status }, 201);
    });
    app.get("/federation/clients", admin, async (c) => {
      const rows = (await new AuthStore(env(c).db).listFederationClients(c.req.query("status"))).results;
      return ok(c, { items: rows.map((r) => ({ id: r.id, clientId: r.client_id, siteName: r.site_name, redirectUri: r.redirect_uri, status: r.status, createdAt: r.created_at, approvedAt: r.approved_at, secretRotatedAt: r.secret_rotated_at })) });
    });
    app.post("/federation/clients/:id/approve", admin, async (c) => {
      const secret = randomToken(32);
      const approved = await new AuthStore(env(c).db).approveFederationClient(c.req.param("id"), await sha256Hex(secret));
      if (!approved) throw new ApiError(404, "NOT_FOUND", "No pending registration with that id.");
      return ok(c, { clientSecret: secret });
    });
    // Mints a new secret for an already-approved client; the old one stops working immediately.
    // The consumer admin must copy it into their own providers.peer.trust config right after —
    // same manual step as the initial approval, no automated push to the consumer.
    app.post("/federation/clients/:id/rotate", admin, async (c) => {
      const secret = randomToken(32);
      const rotated = await new AuthStore(env(c).db).rotateFederationClientSecret(c.req.param("id"), await sha256Hex(secret));
      if (!rotated) throw new ApiError(404, "NOT_FOUND", "No approved client with that id.");
      return ok(c, { clientSecret: secret });
    });
    // Stops trust immediately: /federation/authorize and /federation/token both gate on status
    // 'approved', so a revoked client can no longer start a new authorization or exchange a code,
    // even one issued moments earlier. Unlike rotate, there is no new secret to hand back.
    app.post("/federation/clients/:id/revoke", admin, async (c) => {
      const revoked = await new AuthStore(env(c).db).revokeFederationClient(c.req.param("id"));
      if (!revoked) throw new ApiError(404, "NOT_FOUND", "No approved client with that id.");
      return ok(c, { status: "revoked" });
    });
    app.get("/federation/authorize", auth, async (c) => {
      const e = env(c);
      const clientId = c.req.query("client_id") ?? "";
      const redirectUri = c.req.query("redirect_uri") ?? "";
      const client = await new AuthStore(e.db).federationClientByClientId(clientId);
      if (!client || client.status !== "approved" || client.redirect_uri !== redirectUri) throw new ApiError(400, "INVALID_CLIENT", "This client is not registered and approved for that redirect URI.");
      const code = await new AuthStore(e.db).createFederationCode(clientId, c.get("user").id, redirectUri);
      const url = new URL(redirectUri);
      url.searchParams.set("code", code);
      if (c.req.query("state")) url.searchParams.set("state", c.req.query("state")!);
      return c.redirect(url.toString());
    });
    app.post("/federation/token", async (c) => {
      const e = env(c);
      if (!peerIssuerConfigured(e)) throw new ApiError(503, "PROVIDER_DISABLED", "This site is not configured as a federation issuer.");
      const input = federationTokenBody.parse(await c.req.json());
      const store = new AuthStore(e.db);
      const client = await store.federationClientByClientId(input.clientId);
      if (!client || client.status !== "approved" || !client.client_secret_hash || !safeEqual(client.client_secret_hash, await sha256Hex(input.clientSecret))) throw new ApiError(401, "INVALID_CLIENT", "Unknown client or client secret.");
      const grant = await store.consumeFederationCode(input.code);
      if (!grant || grant.clientId !== input.clientId || grant.redirectUri !== input.redirectUri) throw new ApiError(400, "INVALID_GRANT", "This authorization code is invalid or has expired.");
      const user = await store.userById(grant.userId);
      if (!user) throw new ApiError(401, "UNAUTHORIZED", "This account is no longer active.");
      return ok(c, { idToken: await signFederationIdToken(e, input.clientId, user) });
    });
    app.get("/federation/.well-known/jwks.json", (c) => {
      const e = env(c);
      if (!peerIssuerConfigured(e)) throw new ApiError(503, "PROVIDER_DISABLED", "This site is not configured as a federation issuer.");
      return ok(c, federationJwks(e));
    });
  }

  // ----- peer consumer: sign in with an account from a trusted kashi site -----
  if (p.peer?.trust?.length) {
    const trustByKey = (key: string): PeerTrustConfig | undefined => p.peer!.trust![Number(key)];
    const redirectUri = (e: AuthEnv) => `${e.authUrl}/peer/callback`;
    app.get("/peer/:key/start", async (c) => {
      const e = env(c);
      const key = c.req.param("key");
      const trust = trustByKey(key);
      if (!trust) throw new ApiError(404, "NOT_FOUND", "Unknown peer.");
      if (!e.authUrl) throw new Error("@softwareseva/auth: AUTH_URL must be the public URL of this router, e.g. https://api.example.com/v1/auth");
      const state = await signPeerState(e, { key, next: safeNext(c.req.query("next")) });
      return c.redirect(peerAuthorizeUrl(trust, redirectUri(e), state));
    });
    app.get("/peer/callback", async (c) => {
      const e = env(c);
      const fail = (code: string) => c.redirect(`${e.appOrigin}/sign-in?error=${code}`);
      const state = await verifyPeerState(e, c.req.query("state") ?? "");
      if (!state) return fail("OAUTH_STATE_INVALID");
      const trust = trustByKey(state.key);
      const code = c.req.query("code");
      if (!trust || !code) return fail("OAUTH_FAILED");
      try {
        const profile = await exchangePeerCode(trust, code, redirectUri(e));
        const user = await userForIdentity(c, config, e, "kashi", profile, trust.allowSignUp !== false);
        await completeSignIn(c, config, e, user, "kashi", "cookie");
        return c.redirect(`${e.appOrigin}${state.next}`);
      } catch {
        return fail("OAUTH_FAILED");
      }
    });
    // For native apps: the app opens `/peer/:key/start` in a system browser and catches the final
    // redirect itself (e.g. via a universal link on this same AUTH_URL host), then posts the code
    // here to complete the exchange — the client_secret never leaves this backend.
    app.post("/peer/token", async (c) => {
      const e = env(c);
      const input = peerTokenBody.parse(await c.req.json());
      const trust = trustByKey(input.key);
      if (!trust) throw new ApiError(404, "NOT_FOUND", "Unknown peer.");
      const profile = await exchangePeerCode(trust, input.code, redirectUri(e)).catch(() => { throw new ApiError(401, "OAUTH_FAILED", "Peer sign-in could not be verified."); });
      const user = await userForIdentity(c, config, e, "kashi", profile, trust.allowSignUp !== false);
      return ok(c, await completeSignIn(c, config, e, user, "kashi", input.transport, input.deviceName));
    });
  }

  return app;
}

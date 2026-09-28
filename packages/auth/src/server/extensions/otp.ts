/**
 * Dual-channel OTP with separate sign-in and authenticated contact-link challenges, each bound to
 * `(channel, purpose, destination, user)` so a sign-in code can never be replayed to link a
 * contact (or vice versa), and a code sent to one destination never matches another.
 */
import { Hono } from "hono";
import { z } from "zod";
import { ApiError, consumeRateLimit, clientIp, sha256, normalizeEmail, normalizePhone, randomDigits, hmac, safeEqual, futureIso, nowIso, ok } from "@softwareseva/core/server";
import { resolveEnv } from "../env";
import { AuthStore } from "../store";
import { createUser } from "../users";
import { requireAuth, completeSignIn } from "../session";
import type { AuthConfig, AuthVariables, OtpPurpose } from "../types";
import { ExtensionStore } from "./store";
import { requireRecent } from "./recovery";

const peek = z.object({ channel: z.enum(["email", "phone"]).optional() });
const input = z.object({ channel: z.enum(["email", "phone"]), destination: z.string().min(3).max(254), code: z.string().regex(/^\d{4,8}$/).optional() });
const purposes = ["sign-in", "link"] as const satisfies readonly OtpPurpose[];

/**
 * Mounted alongside (not instead of) the legacy single-channel `providers.otp`: `/otp/request`
 * and `/otp/verify` are shared, so a request whose `channel` isn't one this router's
 * `otpChannels` configures falls through to the legacy handler (mounted after it) via `next()`,
 * rather than erroring. `/contacts/otp/*` has no legacy equivalent, so those paths are strict.
 */
export function multiOtpRouter(config: AuthConfig) {
  const app = new Hono<{ Bindings: Record<string, unknown>; Variables: AuthVariables }>();
  for (const purpose of purposes) {
    const prefix = purpose === "link" ? "/contacts/otp" : "/otp";
    if (purpose === "link") app.use(prefix + "/*", requireAuth(config));
    for (const action of ["request", "verify"] as const)
      app.post(prefix + "/" + action, async (c, next) => {
        const env = resolveEnv(config, c.env);
        const raw = await c.req.json();
        const channel = peek.parse(raw).channel;
        const provider = channel ? config.otpChannels?.[channel] : undefined;
        if (!provider) {
          if (purpose === "sign-in") return next();
          throw new ApiError(503, "PROVIDER_DISABLED", "This OTP channel is unavailable.");
        }
        const body = input.parse(raw);
        if (!env.otpPepper) throw new ApiError(503, "PROVIDER_DISABLED", "This OTP channel is unavailable.");
        const destination = body.channel === "email" ? normalizeEmail(body.destination) : normalizePhone(body.destination, { defaultCountry: provider.defaultCountry as never, mobileOnly: true });
        const userId = purpose === "link" ? c.get("user").id : "";
        if (purpose === "link") await requireRecent(c, env, config);
        await consumeRateLimit(env.db, `otp:${action}:ip:${await sha256(clientIp(c))}`, action === "request" ? 10 : 30, 600);
        if (!destination) {
          if (action === "request") return ok(c, { sent: true });
          throw new ApiError(401, "INVALID_CODE", "Invalid or expired code.");
        }
        const store = new ExtensionStore(env.db);
        const auth = new AuthStore(env.db);
        const ttlSeconds = provider.ttlSeconds ?? 300;
        const maxAttempts = provider.maxAttempts ?? 5;
        const binding = `${body.channel}:${purpose}:${userId}:${destination}`;
        if (action === "request") {
          await consumeRateLimit(env.db, `otp:dest:${await sha256(destination)}`, 3, 600);
          const code = randomDigits(provider.codeLength ?? 6);
          await store.createOtp(body.channel, purpose, destination, userId, await hmac(`${binding}:${code}`, env.otpPepper), futureIso(ttlSeconds));
          await provider.send(env, destination, code, c, { purpose, ttlSeconds });
          return ok(c, { sent: true });
        }
        const row = await store.otp(body.channel, purpose, destination, userId);
        if (!row || !body.code || row.attempts >= maxAttempts || row.expires_at <= nowIso())
          throw new ApiError(401, "INVALID_CODE", "Invalid or expired code.");
        if (!safeEqual(row.code_hash, await hmac(`${binding}:${body.code}`, env.otpPepper))) {
          await store.failOtp(row.id);
          throw new ApiError(401, "INVALID_CODE", "Invalid or expired code.");
        }
        if (!(await store.consumeOtp(row.id, maxAttempts))) throw new ApiError(401, "INVALID_CODE", "Invalid or expired code.");
        const aliasId = await store.contactOwner(body.channel, destination);
        const aliasUser = aliasId ? await auth.userById(aliasId) : null;
        if (aliasId && !aliasUser) throw new ApiError(403, "ACCOUNT_DISABLED", "Account disabled.");
        const existing = aliasUser
          ? { user: aliasUser, disabled: false }
          : body.channel === "email"
            ? await auth.userByEmail(destination)
            : await auth.userByPhone(destination);
        if (existing?.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "Account disabled.");
        if (purpose === "link") {
          if (existing && existing.user.id !== userId) throw new ApiError(409, "ACCOUNT_MERGE_REQUIRED", "Authenticate both accounts to merge them.");
          await store.attachContact(userId, body.channel, destination);
          return ok(c, { user: await auth.userById(userId) });
        }
        if (!existing && provider.allowSignUp === false) throw new ApiError(401, "INVALID_CODE", "Invalid or expired code.");
        const user = existing?.user ?? (await createUser(c, config, env, "otp", body.channel === "email" ? { name: destination, email: destination, emailVerified: true } : { name: destination, phone: destination, phoneVerified: true }));
        await auth.markVerified(user.id, body.channel);
        return ok(c, await completeSignIn(c, config, env, (await auth.userById(user.id))!, `otp:${body.channel}`, "cookie"));
      });
  }
  return app;
}

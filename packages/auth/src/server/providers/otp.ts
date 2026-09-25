/** One-time codes over WhatsApp, SMS or email. Codes are stored as peppered HMACs; responses never reveal whether an account exists. */
import type { Context } from "hono";
import { z } from "zod";
import { ApiError, clientIp, consumeRateLimit, futureIso, hmac, normalizeEmail, normalizePhone, nowIso, randomDigits, safeEqual, sha256 } from "@kashi/core/server";
import { AuthStore } from "../store";
import { createUser } from "../users";
import type { AuthConfig, AuthEnv, AuthUser, OtpProviderConfig } from "../types";

export const otpRequestSchema = z.object({ destination: z.string().trim().min(3).max(254) });
export const otpVerifySchema = z.object({ destination: z.string().trim().min(3).max(254), code: z.string().trim().regex(/^\d{4,8}$/), name: z.string().trim().max(120).optional(), transport: z.enum(["cookie", "token"]).default("cookie"), deviceName: z.string().max(80).optional() });

function normalizeDestination(raw: string, otp: OtpProviderConfig): string | null {
  return otp.channel === "phone" ? normalizePhone(raw, { defaultCountry: otp.defaultCountry as never, mobileOnly: true }) : normalizeEmail(raw);
}

const pepper = (env: AuthEnv) => { if (!env.otpPepper) throw new Error("@kashi/auth: OTP_PEPPER is not set. See secrets.json."); return env.otpPepper; };

/** Generate, store and send a code. Silently succeeds for unusable destinations so callers cannot enumerate. */
export async function requestOtp(c: Context, config: AuthConfig, env: AuthEnv, raw: string): Promise<void> {
  const otp = config.providers.otp!;
  await consumeRateLimit(env.db, `auth-otp:ip:${await sha256(clientIp(c))}`, 10, 600);
  const destination = normalizeDestination(raw, otp);
  if (!destination) return;
  await consumeRateLimit(env.db, `auth-otp:dest:${await sha256(destination)}`, 3, 600);
  const store = new AuthStore(env.db);
  if (otp.allowSignUp === false) {
    const existing = otp.channel === "phone" ? await store.userByPhone(destination) : await store.userByEmail(destination);
    if (!existing || existing.disabled) return;
  }
  const code = randomDigits(otp.codeLength ?? 6);
  await store.createOtp(destination, await hmac(`${destination}:${code}`, pepper(env)), futureIso(otp.ttlSeconds ?? 300));
  await otp.send(env, destination, code, c);
}

/** Verify a code; creates the account when allowed. Returns the user for the session step. */
export async function verifyOtp(c: Context, config: AuthConfig, env: AuthEnv, input: { destination: string; code: string; name?: string }): Promise<AuthUser> {
  const otp = config.providers.otp!;
  const invalid = () => new ApiError(401, "INVALID_CODE", "The code is invalid or has expired.");
  await consumeRateLimit(env.db, `auth-otp-verify:ip:${await sha256(clientIp(c))}`, 30, 600);
  const destination = normalizeDestination(input.destination, otp);
  if (!destination) throw invalid();
  const store = new AuthStore(env.db);
  const record = await store.latestOtp(destination);
  if (!record || record.attempts >= (otp.maxAttempts ?? 5) || record.expires_at <= nowIso()) throw invalid();
  const expected = await hmac(`${destination}:${input.code}`, pepper(env));
  if (!safeEqual(record.code_hash, expected)) { await store.failOtp(record.id); throw invalid(); }
  await store.consumeOtp(record.id);
  const existing = otp.channel === "phone" ? await store.userByPhone(destination) : await store.userByEmail(destination);
  if (existing) {
    if (existing.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    await store.markVerified(existing.user.id, otp.channel);
    if (input.name) await store.setName(existing.user.id, input.name);
    return (await store.userById(existing.user.id)) ?? existing.user;
  }
  if (otp.allowSignUp === false) throw invalid();
  return createUser(c, config, env, "otp", otp.channel === "phone" ? { name: input.name ?? destination, phone: destination, phoneVerified: true } : { name: input.name ?? destination, email: destination, emailVerified: true });
}

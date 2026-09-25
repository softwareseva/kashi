/** Password sign-in and password changes. Enumeration-safe: unknown users and wrong passwords answer alike. */
import type { Context } from "hono";
import { z } from "zod";
import { ApiError, consumeRateLimit, clientIp, hashPassword, normalizeEmail, normalizePhone, passwordProblem, sha256, verifyPassword } from "@kashi/core/server";
import { AuthStore } from "../store";
import type { AuthConfig, AuthEnv, AuthUser } from "../types";

export const passwordSignInSchema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(256), transport: z.enum(["cookie", "token"]).default("cookie"), deviceName: z.string().max(80).optional() });
export const passwordChangeSchema = z.object({ currentPassword: z.string().max(256).optional(), newPassword: z.string().min(1).max(256) });

export function normalizeIdentifier(raw: string, defaultCountry?: string): string {
  return normalizePhone(raw, { defaultCountry: defaultCountry as never }) ?? normalizeEmail(raw) ?? raw.trim().toLowerCase();
}

export async function authenticatePassword(c: Context, env: AuthEnv, identifier: string, password: string): Promise<AuthUser> {
  await consumeRateLimit(env.db, `auth-pw:ip:${await sha256(clientIp(c))}`, 20, 900);
  await consumeRateLimit(env.db, `auth-pw:id:${await sha256(identifier)}`, 8, 900);
  const store = new AuthStore(env.db);
  const found = await store.userByIdentifier(identifier);
  const hash = found ? await store.passwordHash(found.user.id) : null;
  // Always run a verification so timing does not reveal whether the account exists.
  const ok = await verifyPassword(password, hash ?? "pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!found || !hash || !ok) throw new ApiError(401, "INVALID_CREDENTIALS", "The identifier or password is incorrect.");
  if (found.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  return found.user;
}

export async function changePassword(env: AuthEnv, config: AuthConfig, user: AuthUser, input: { currentPassword?: string; newPassword: string }) {
  const problem = passwordProblem(input.newPassword);
  if (problem) throw new ApiError(422, "VALIDATION_ERROR", problem, { newPassword: [problem] });
  const store = new AuthStore(env.db);
  const existing = await store.passwordHash(user.id);
  if (existing && !(input.currentPassword && (await verifyPassword(input.currentPassword, existing)))) throw new ApiError(401, "INVALID_CREDENTIALS", "The current password is incorrect.");
  await store.setPassword(user.id, await hashPassword(input.newPassword));
  await store.revokeAllForUser(user.id);
  void config;
}

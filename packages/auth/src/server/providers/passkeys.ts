/** WebAuthn passkeys on @simplewebauthn/server: registration for signed-in users, discoverable sign-in for everyone. */
import type { Context } from "hono";
import { z } from "zod";
import { ApiError, base64UrlToBytes, bytesToBase64Url, clientIp, consumeRateLimit, sha256 } from "@softwareseva/core/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { AuthStore } from "../store";
import type { AuthConfig, AuthEnv, AuthUser } from "../types";

export const passkeyRegisterVerifySchema = z.object({ challengeId: z.string().min(1), response: z.custom<RegistrationResponseJSON>((v) => typeof v === "object" && v !== null), deviceName: z.string().trim().min(1).max(80).default("Passkey") });
export const passkeyAuthVerifySchema = z.object({ challengeId: z.string().min(1), response: z.custom<AuthenticationResponseJSON>((v) => typeof v === "object" && v !== null), transport: z.enum(["cookie", "token"]).default("cookie"), deviceName: z.string().max(80).optional() });
export const passkeyRenameSchema = z.object({ deviceName: z.string().trim().min(1).max(80) });
export const passkeySignupVerifySchema = passkeyRegisterVerifySchema.extend({ name: z.string().trim().max(120).optional(), transport: z.enum(["cookie", "token"]).default("cookie") });

async function lib() {
  try { return await import("@simplewebauthn/server"); } catch { throw new Error("@softwareseva/auth: install @simplewebauthn/server to enable passkeys."); }
}
const rp = (env: AuthEnv, config: AuthConfig) => {
  if (!env.rpId) throw new Error("@softwareseva/auth: RP_ID is not set (the site's registrable domain).");
  return { rpID: env.rpId, rpName: env.rpName ?? "App", origins: [...env.origins, ...(config.providers.passkeys?.extraOrigins ?? [])] };
};

export async function registrationOptions(config: AuthConfig, env: AuthEnv, user: AuthUser) {
  const { generateRegistrationOptions } = await lib();
  const store = new AuthStore(env.db);
  const existing = (await store.listPasskeys(user.id)).results;
  const { rpID, rpName } = rp(env, config);
  const options = await generateRegistrationOptions({
    rpName, rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.phone ?? user.id,
    userDisplayName: user.name,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: existing.map((p) => ({ id: p.credential_id, transports: p.transports ? (JSON.parse(p.transports) as never) : undefined })),
  });
  const challengeId = await store.createChallenge(user.id, "register", options.challenge);
  return { options, challengeId };
}

export async function verifyRegistration(config: AuthConfig, env: AuthEnv, user: AuthUser, input: z.infer<typeof passkeyRegisterVerifySchema>) {
  const { verifyRegistrationResponse } = await lib();
  const store = new AuthStore(env.db);
  const challenge = await store.consumeChallenge(input.challengeId, "register", user.id);
  if (!challenge) throw new ApiError(401, "CHALLENGE_EXPIRED", "The passkey challenge expired. Please try again.");
  const { rpID, origins } = rp(env, config);
  const result = await verifyRegistrationResponse({ response: input.response, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true }).catch(() => null);
  if (!result?.verified) throw new ApiError(401, "PASSKEY_REJECTED", "The passkey could not be verified.");
  const cred = result.registrationInfo.credential;
  await store.addPasskey(user.id, cred.id, bytesToBase64Url(cred.publicKey), cred.counter, input.response.response.transports ?? [], input.deviceName, result.registrationInfo.credentialBackedUp, rpID);
  return { id: cred.id, deviceName: input.deviceName };
}

/** Anonymous signup creates accounts and challenge rows, so options and verify share one per-IP bucket (~10 signups / 10 min). */
const signupRateLimit = async (c: Context, env: AuthEnv) => consumeRateLimit(env.db, `auth-pk-signup:ip:${await sha256(clientIp(c))}`, 20, 600);

/**
 * Contact-free signup: options for a brand-new, anonymous account. No user exists yet, so the
 * WebAuthn ceremony gets a throwaway user handle — it is never stored, only the resulting
 * credential is, once {@link verifyAnonymousRegistration} confirms it.
 */
export async function anonymousRegistrationOptions(c: Context, config: AuthConfig, env: AuthEnv) {
  await signupRateLimit(c, env);
  const { generateRegistrationOptions } = await lib();
  const { rpID, rpName } = rp(env, config);
  const anonId = crypto.randomUUID();
  const options = await generateRegistrationOptions({
    rpName, rpID,
    userID: new TextEncoder().encode(anonId),
    userName: `passkey-${anonId.slice(0, 8)}`,
    userDisplayName: "New account",
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await new AuthStore(env.db).createChallenge(null, "signup", options.challenge);
  return { options, challengeId };
}

/**
 * Verify the passkey first; only on success is an account created and the credential attached to
 * it, in one write (`AuthStore.createUserWithPasskey`). Nothing is ever persisted for a rejected
 * or abandoned registration — there is no account to clean up.
 */
export async function verifyAnonymousRegistration(c: Context, config: AuthConfig, env: AuthEnv, input: z.infer<typeof passkeySignupVerifySchema>): Promise<AuthUser> {
  await signupRateLimit(c, env);
  const { verifyRegistrationResponse } = await lib();
  const store = new AuthStore(env.db);
  const challenge = await store.consumeChallenge(input.challengeId, "signup", null);
  if (!challenge) throw new ApiError(401, "CHALLENGE_EXPIRED", "The passkey challenge expired. Please try again.");
  const { rpID, origins } = rp(env, config);
  const result = await verifyRegistrationResponse({ response: input.response, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true }).catch(() => null);
  if (!result?.verified) throw new ApiError(401, "PASSKEY_REJECTED", "The passkey could not be verified.");
  const cred = result.registrationInfo.credential;
  const user = await store.createUserWithPasskey(
    { name: input.name?.trim() || "New account", roles: config.defaultRoles ?? ["user"] },
    { credentialId: cred.id, publicKey: bytesToBase64Url(cred.publicKey), counter: cred.counter, transports: input.response.response.transports ?? [], deviceName: input.deviceName, backedUp: result.registrationInfo.credentialBackedUp, rpId: rpID },
  );
  await config.hooks?.onUserCreated?.(user, "passkey", c);
  return user;
}

/** Discoverable (usernameless) options: the browser shows the passkeys it holds for this RP. */
export async function authenticationOptions(c: Context, config: AuthConfig, env: AuthEnv) {
  const { generateAuthenticationOptions } = await lib();
  await consumeRateLimit(env.db, `auth-pk:ip:${await sha256(clientIp(c))}`, 30, 600);
  const { rpID } = rp(env, config);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  const challengeId = await new AuthStore(env.db).createChallenge(null, "authenticate", options.challenge);
  return { options, challengeId };
}

export async function verifyAuthentication(config: AuthConfig, env: AuthEnv, input: z.infer<typeof passkeyAuthVerifySchema>): Promise<AuthUser> {
  const { verifyAuthenticationResponse } = await lib();
  const store = new AuthStore(env.db);
  const rejected = () => new ApiError(401, "PASSKEY_REJECTED", "The passkey could not be verified.");
  const challenge = await store.consumeChallenge(input.challengeId, "authenticate", null);
  const key = await store.passkeyByCredential(input.response.id);
  if (!challenge || !key) throw rejected();
  const { rpID, origins } = rp(env, config);
  const result = await verifyAuthenticationResponse({
    response: input.response, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: key.credential_id, publicKey: base64UrlToBytes(key.public_key), counter: key.counter, transports: key.transports ? (JSON.parse(key.transports) as never) : undefined },
  }).catch(() => null);
  if (!result?.verified) throw rejected();
  await store.updatePasskeyCounter(key.id, result.authenticationInfo.newCounter);
  const user = await store.userById(key.user_id);
  if (!user) throw rejected();
  return user;
}

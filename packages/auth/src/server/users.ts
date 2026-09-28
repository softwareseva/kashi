/** Find-or-create helpers shared by the providers. */
import type { Context } from "hono";
import { ApiError } from "@softwareseva/core/server";
import { AuthStore } from "./store";
import { ExtensionStore } from "./extensions/store";
import type { AuthConfig, AuthEnv, AuthUser } from "./types";

const disabled = () => new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");

/**
 * Providers whose `emailVerified` claim is trustworthy enough to auto-link to an existing local
 * account. Google and Apple attest they verified the address themselves. Facebook merely reports
 * `Boolean(email)` (see providers/facebook.ts), and a peer site's claim is only as trustworthy as
 * that peer's own auth stack — neither is safe to treat as proof of ownership here.
 */
const emailVerificationTrusted = new Set(["google", "apple"]);

export async function createUser(c: Context, config: AuthConfig, env: AuthEnv, provider: string, input: { name: string; email?: string | null; phone?: string | null; emailVerified?: boolean; phoneVerified?: boolean }): Promise<AuthUser> {
  const user = await new AuthStore(env.db).createUser({ ...input, roles: config.defaultRoles ?? ["user"] });
  await config.hooks?.onUserCreated?.(user, provider, c);
  return user;
}

/**
 * Resolve a verified external profile (google/apple/facebook/peer) to a user: by identity, then
 * by verified email, else create. `config.autoLinkVerifiedEmail` (default true) controls the
 * middle step: when explicitly `false`, a verified-email match is treated as a collision the
 * user must resolve by signing in and linking explicitly, instead of being linked silently.
 * Only a provider in `emailVerificationTrusted` can drive that middle step at all — for the
 * others, a matching email always requires an explicit merge, never a silent auto-link.
 */
export async function userForIdentity(c: Context, config: AuthConfig, env: AuthEnv, provider: string, profile: { subject: string; email: string | null; emailVerified: boolean; name: string | null }, allowSignUp: boolean): Promise<AuthUser> {
  const store = new AuthStore(env.db);
  const byIdentity = await store.userByIdentity(provider, profile.subject);
  if (byIdentity) { if (byIdentity.disabled) throw disabled(); return byIdentity.user; }
  const emailVerified = Boolean(profile.email) && profile.emailVerified && emailVerificationTrusted.has(provider);
  if (emailVerified && config.autoLinkVerifiedEmail !== false) {
    const byEmail = await store.userByEmail(profile.email!);
    if (byEmail) {
      if (byEmail.disabled) throw disabled();
      await store.linkIdentity(byEmail.user.id, provider, profile.subject, profile.email);
      await store.markVerified(byEmail.user.id, "email");
      if (profile.name) await store.setName(byEmail.user.id, profile.name);
      if (config.identityExtensions) await new ExtensionStore(env.db).recordAlias("email", profile.email!, byEmail.user.id);
      return (await store.userById(byEmail.user.id)) ?? byEmail.user;
    }
  } else if (profile.email && profile.emailVerified) {
    // Either the provider's verified claim isn't trustworthy (see emailVerificationTrusted), or
    // the app opted out of silent auto-linking — either way, a matching email is a collision the
    // user must resolve explicitly rather than something we link or create an account over.
    const collision = (await store.userByEmail(profile.email)) || (config.identityExtensions ? Boolean(await new ExtensionStore(env.db).contactOwner("email", profile.email)) : false);
    if (collision) throw new ApiError(409, "ACCOUNT_MERGE_REQUIRED", "Sign in to your existing account and explicitly link this identity.");
  }
  if (!allowSignUp) throw new ApiError(403, "SIGN_UP_DISABLED", "No account exists for this identity.");
  const user = await createUser(c, config, env, provider, { name: profile.name ?? profile.email ?? "User", email: emailVerified ? profile.email : null, emailVerified });
  await store.linkIdentity(user.id, provider, profile.subject, profile.email);
  return user;
}

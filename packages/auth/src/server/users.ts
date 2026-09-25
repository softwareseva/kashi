/** Find-or-create helpers shared by the providers. */
import type { Context } from "hono";
import { ApiError } from "@softwareseva/core/server";
import { AuthStore } from "./store";
import type { AuthConfig, AuthEnv, AuthUser } from "./types";

const disabled = () => new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");

export async function createUser(c: Context, config: AuthConfig, env: AuthEnv, provider: string, input: { name: string; email?: string | null; phone?: string | null; emailVerified?: boolean; phoneVerified?: boolean }): Promise<AuthUser> {
  const user = await new AuthStore(env.db).createUser({ ...input, roles: config.defaultRoles ?? ["user"] });
  await config.hooks?.onUserCreated?.(user, provider, c);
  return user;
}

/** Resolve a verified external profile (google/apple) to a user: by identity, then by verified email, else create. */
export async function userForIdentity(c: Context, config: AuthConfig, env: AuthEnv, provider: string, profile: { subject: string; email: string | null; emailVerified: boolean; name: string | null }, allowSignUp: boolean): Promise<AuthUser> {
  const store = new AuthStore(env.db);
  const byIdentity = await store.userByIdentity(provider, profile.subject);
  if (byIdentity) { if (byIdentity.disabled) throw disabled(); return byIdentity.user; }
  if (profile.email && profile.emailVerified) {
    const byEmail = await store.userByEmail(profile.email);
    if (byEmail) {
      if (byEmail.disabled) throw disabled();
      await store.linkIdentity(byEmail.user.id, provider, profile.subject, profile.email);
      await store.markVerified(byEmail.user.id, "email");
      if (profile.name) await store.setName(byEmail.user.id, profile.name);
      return (await store.userById(byEmail.user.id)) ?? byEmail.user;
    }
  }
  if (!allowSignUp) throw new ApiError(403, "SIGN_UP_DISABLED", "No account exists for this identity.");
  const user = await createUser(c, config, env, provider, { name: profile.name ?? profile.email ?? "User", email: profile.emailVerified ? profile.email : null, emailVerified: profile.emailVerified });
  await store.linkIdentity(user.id, provider, profile.subject, profile.email);
  return user;
}

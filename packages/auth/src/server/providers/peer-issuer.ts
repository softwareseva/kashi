/** Acting as an OIDC-style issuer for other kashi sites: RS256 ID tokens and JWKS export. Authorization codes are single-use and live in `auth_federation_codes` (see AuthStore), not here. */
import { sign } from "hono/jwt";
import { federationPrivateJwk, federationPublicJwk } from "../federation/keys";
import type { AuthEnv, AuthUser } from "../types";

const ID_TOKEN_TTL = 300;

export function peerIssuerConfigured(env: AuthEnv) { return Boolean(env.federationPrivateKey); }

/** Handed to the consumer at the token endpoint; signed with the dedicated federation keypair, never JWT_SECRET. */
export async function signFederationIdToken(env: AuthEnv, clientId: string, user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: env.authUrl, aud: clientId, sub: user.id, email: user.email, email_verified: Boolean(user.emailVerifiedAt), name: user.name, iat: now, exp: now + ID_TOKEN_TTL };
  return sign(claims, federationPrivateJwk(env), "RS256");
}

export function federationJwks(env: AuthEnv) {
  return { keys: [federationPublicJwk(env)] };
}

/** @kashi/auth/server — mountable authentication for Hono on Workers + D1. */
export { authRouter } from "./router";
export { requireAuth, optionalAuth, requireRole, issueSession, issueTokenPair, rotateRefreshToken, signAccessToken, verifyAccessToken, clearSessionCookies, completeSignIn, DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL, type AccessClaims } from "./session";
export { resolveEnv } from "./env";
export { AuthStore } from "./store";
export { createUser, userForIdentity } from "./users";
export { hashPassword, verifyPassword, passwordProblem } from "@kashi/core/server";
export type { AuthConfig, AuthEnv, AuthUser, AuthHooks, AuthVariables, OtpProviderConfig, OAuthProviderConfig, AppleProviderConfig, PasskeyProviderConfig, SessionPair, Transport } from "./types";
export { appleClientSecret, verifyAppleIdToken } from "./providers/apple";
export { verifyGoogleIdToken } from "./providers/google";

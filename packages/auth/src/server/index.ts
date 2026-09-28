/** @softwareseva/auth/server — mountable authentication for Hono on Workers + D1. */
export { authRouter } from "./router";
export { requireAuth, optionalAuth, requireRole, requireVerified, isVerifiedIdentity, issueSession, issueTokenPair, rotateRefreshToken, signAccessToken, verifyAccessToken, clearSessionCookies, completeSignIn, assertSameOrigin, DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL, DEFAULT_REFRESH_REUSE_GRACE, type AccessClaims } from "./session";
export { resolveEnv } from "./env";
export { AuthStore } from "./store";
export { createUser, userForIdentity } from "./users";
export { ExtensionStore } from "./extensions/store";
export { requireRecent } from "./extensions/recovery";
export { boundState, consumeBoundState } from "./extensions/browser-state";
export { hashPassword, verifyPassword, passwordProblem } from "@softwareseva/core/server";
export type { AuthConfig, AuthEnv, AuthUser, AuthHooks, AuthVariables, OtpProviderConfig, OtpPurpose, OAuthProviderConfig, AppleProviderConfig, FacebookProviderConfig, PasskeyProviderConfig, PeerProviderConfig, PeerTrustConfig, SessionPair, Transport } from "./types";
export { renderOtpEmail, type OtpEmailPurpose, type OtpEmailBrand, type RenderOtpEmailInput, type RenderedEmail } from "./email-template";
export { appleClientSecret, verifyAppleIdToken } from "./providers/apple";
export { verifyGoogleIdToken } from "./providers/google";
export { verifyFacebookAccessToken } from "./providers/facebook";
export { generateFederationKeypair, type FederationJwk } from "./federation/keys";

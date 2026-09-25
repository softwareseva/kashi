/** @kashi/auth/contracts — request and response shapes shared by the server, React and Flutter clients. */
import { z } from "zod";

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  roles: z.array(z.string()),
  emailVerifiedAt: z.string().nullable(),
  phoneVerifiedAt: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export type Transport = "cookie" | "token";
/** Cookie transport answers `{ user }`; token transport adds the pair. */
export type SessionResponse = { user: AuthUser; accessToken?: string; refreshToken?: string; expiresIn?: number };

export type AuthConfigResponse = { providers: { password: boolean; otp: { channel: "phone" | "email" } | null; google: boolean; apple: boolean; passkeys: boolean } };

export const passwordSignInRequest = z.object({ identifier: z.string().min(3), password: z.string().min(1), transport: z.enum(["cookie", "token"]).optional(), deviceName: z.string().optional() });
export const otpRequestRequest = z.object({ destination: z.string().min(3) });
export const otpVerifyRequest = z.object({ destination: z.string().min(3), code: z.string().regex(/^\d{4,8}$/), name: z.string().optional(), transport: z.enum(["cookie", "token"]).optional(), deviceName: z.string().optional() });
export const idTokenRequest = z.object({ idToken: z.string().min(20), transport: z.enum(["cookie", "token"]).optional(), deviceName: z.string().optional(), name: z.string().optional() });
export const refreshRequest = z.object({ refreshToken: z.string().min(20) });

export type PasskeyItem = { id: string; deviceName: string; backedUp: boolean; createdAt: string; lastUsedAt: string | null };

/** Error codes the auth router emits beyond the core set. */
export const AuthErrorCodes = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_CODE: "INVALID_CODE",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  SIGN_UP_DISABLED: "SIGN_UP_DISABLED",
  TOKEN_REUSE: "TOKEN_REUSE",
  PROVIDER_DISABLED: "PROVIDER_DISABLED",
  OAUTH_FAILED: "OAUTH_FAILED",
  OAUTH_CANCELLED: "OAUTH_CANCELLED",
  OAUTH_STATE_INVALID: "OAUTH_STATE_INVALID",
  PASSKEY_REJECTED: "PASSKEY_REJECTED",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
} as const;

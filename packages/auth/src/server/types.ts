/** Configuration, environment and user types for @softwareseva/auth. */
import type { Context } from "hono";

export type Transport = "cookie" | "token";

/** What the app sees after authentication. `roles` is a plain string array. */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

export type SessionPair = { accessToken: string; refreshToken: string; expiresIn: number; familyId: string };

/** Bindings the router reads by convention. Override any of them with `config.env`. */
export type AuthEnv = {
  db: D1Database;
  jwtSecret: string;
  issuer: string;
  audience: string;
  /** Web origins allowed to use cookie sessions (CSRF check) and as WebAuthn origins. */
  origins: string[];
  /** Origin to redirect to after OAuth callbacks; defaults to origins[0]. */
  appOrigin: string;
  /** Public URL of this API (for OAuth redirect URIs), e.g. https://api.example.com/v1/auth. */
  authUrl: string;
  secureCookies: boolean;
  otpPepper?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  appleClientId?: string;
  appleTeamId?: string;
  appleKeyId?: string;
  applePrivateKey?: string;
  appleBundleIds?: string[];
  rpId?: string;
  rpName?: string;
};

export type OtpProviderConfig = {
  /** Where codes go. Phone destinations are normalised to E.164, emails lowercased. */
  channel: "phone" | "email";
  /** Deliver the code. Throw to fail the request; the code is never logged. */
  send: (env: AuthEnv, destination: string, code: string, c: Context) => Promise<void>;
  /** Create an account for unknown destinations (default true). */
  allowSignUp?: boolean;
  codeLength?: number;
  ttlSeconds?: number;
  maxAttempts?: number;
  /** Default country for bare phone numbers, e.g. "IN". */
  defaultCountry?: string;
};

export type OAuthProviderConfig = { allowSignUp?: boolean };
export type AppleProviderConfig = OAuthProviderConfig;
export type PasskeyProviderConfig = {
  /** Extra WebAuthn origins, e.g. android:apk-key-hash:... */
  extraOrigins?: string[];
};

export type AuthHooks = {
  /** Called once when a user is created by any provider. Add profile rows here. */
  onUserCreated?: (user: AuthUser, provider: string, c: Context) => Promise<void> | void;
  /** Called on every successful sign-in. */
  onSignIn?: (user: AuthUser, provider: string, c: Context) => Promise<void> | void;
  /** Block sign-in (throw ApiError) or adjust roles before a session is issued. */
  beforeSession?: (user: AuthUser, provider: string, c: Context) => Promise<AuthUser | void> | AuthUser | void;
};

export type AuthConfig = {
  /** Map raw bindings to AuthEnv; defaults read JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, WEB_ORIGIN, APP_ORIGIN, AUTH_URL, ENVIRONMENT, OTP_PEPPER, GOOGLE_*, APPLE_*, RP_ID, RP_NAME, DB. */
  env?: (bindings: Record<string, unknown>) => Partial<AuthEnv>;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  cookieNames?: { access?: string; refresh?: string };
  /** Roles given to users created by providers. */
  defaultRoles?: string[];
  providers: {
    password?: boolean;
    otp?: OtpProviderConfig;
    google?: OAuthProviderConfig;
    apple?: AppleProviderConfig;
    passkeys?: PasskeyProviderConfig;
  };
  hooks?: AuthHooks;
};

export type AuthVariables = { user: AuthUser; sessionTransport: Transport };

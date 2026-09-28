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
  facebookClientId?: string;
  facebookClientSecret?: string;
  rpId?: string;
  rpName?: string;
  /** RS256 private key (JWK JSON) used only to sign federation ID tokens when acting as a peer issuer. */
  federationPrivateKey?: string;
};

/** What a code was issued for. Passed to `send` so the message can be worded accordingly. */
export type OtpPurpose = "sign-in" | "link";

export type OtpProviderConfig = {
  /** Where codes go. Phone destinations are normalised to E.164, emails lowercased. */
  channel: "phone" | "email";
  /**
   * Deliver the code. Throw to fail the request; the code is never logged.
   * The fifth argument carries `purpose` and the configured `ttlSeconds` (default 300);
   * existing four-argument implementations remain valid — JS ignores the extra argument.
   */
  send: (env: AuthEnv, destination: string, code: string, c: Context, meta: { purpose: OtpPurpose; ttlSeconds: number }) => Promise<void>;
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
export type FacebookProviderConfig = OAuthProviderConfig;

/** A kashi site this one trusts as an identity provider ("Sign in with {label ?? issuer}"). */
export type PeerTrustConfig = {
  /** The peer's own AUTH_URL, e.g. https://auth.vvmvp.in/v1/auth. Also its OIDC issuer id. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Shown on the sign-in button; defaults to the issuer host. */
  label?: string;
  allowSignUp?: boolean;
};

export type PeerProviderConfig = {
  /** Let other kashi sites register as clients and sign their users in here. */
  issuer?: { enabled: boolean };
  /** Peers whose users this site accepts, once both admins have approved the relationship. */
  trust?: PeerTrustConfig[];
};
export type PasskeyProviderConfig = {
  /** Extra WebAuthn origins, e.g. android:apk-key-hash:... */
  extraOrigins?: string[];
  /**
   * Allow a brand-new, contact-free account to be created straight from a passkey
   * (`POST /passkeys/signup/*`, no prior sign-in). Default true — passkeys are the
   * default, anonymous entry point; disable to require an OTP/OAuth sign-up first.
   */
  allowSignUp?: boolean;
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
    facebook?: FacebookProviderConfig;
    passkeys?: PasskeyProviderConfig;
    peer?: PeerProviderConfig;
  };
  hooks?: AuthHooks;
};

export type AuthVariables = { user: AuthUser; sessionTransport: Transport };

/** Resolve AuthEnv from Worker bindings using conventional names, with per-app overrides. */
import type { AuthConfig, AuthEnv } from "./types";

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length ? v : undefined);
const list = (v: unknown): string[] | undefined => (typeof v === "string" && v.length ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

export function resolveEnv(config: AuthConfig, raw: Record<string, unknown>): AuthEnv {
  const origins = list(raw.WEB_ORIGINS) ?? list(raw.WEB_ORIGIN) ?? [];
  const base: Partial<AuthEnv> = {
    db: raw.DB as D1Database,
    jwtSecret: str(raw.JWT_SECRET),
    issuer: str(raw.JWT_ISSUER) ?? "kashi",
    audience: str(raw.JWT_AUDIENCE) ?? "kashi",
    origins,
    appOrigin: str(raw.APP_ORIGIN) ?? origins[0],
    authUrl: str(raw.AUTH_URL),
    secureCookies: str(raw.ENVIRONMENT) !== "development" && str(raw.ENVIRONMENT) !== "test",
    otpPepper: str(raw.OTP_PEPPER),
    googleClientId: str(raw.GOOGLE_CLIENT_ID),
    googleClientSecret: str(raw.GOOGLE_CLIENT_SECRET),
    appleClientId: str(raw.APPLE_CLIENT_ID),
    appleTeamId: str(raw.APPLE_TEAM_ID),
    appleKeyId: str(raw.APPLE_KEY_ID),
    applePrivateKey: str(raw.APPLE_PRIVATE_KEY),
    appleBundleIds: list(raw.APPLE_BUNDLE_IDS),
    rpId: str(raw.RP_ID) ?? (origins[0] ? new URL(origins[0]).hostname : undefined),
    rpName: str(raw.RP_NAME) ?? "App",
  };
  const merged = { ...base, ...(config.env ? config.env(raw) : {}) } as AuthEnv;
  const missing = (["db", "jwtSecret"] as const).filter((k) => !merged[k]);
  if (missing.length) throw new Error(`@softwareseva/auth: missing ${missing.map((k) => (k === "db" ? "DB binding" : "JWT_SECRET")).join(", ")}. See secrets.json.`);
  if (!merged.origins.length) throw new Error("@softwareseva/auth: set WEB_ORIGIN (or WEB_ORIGINS) to the browser origin(s) that use cookie sessions.");
  return merged;
}

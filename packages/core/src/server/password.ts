/** PBKDF2-SHA-256 password hashing on WebCrypto, portable between Workers and Node. */

/**
 * Cloudflare Workers cap PBKDF2 at 100,000 iterations in production (local `wrangler dev` does not
 * enforce it, so a higher value passes every local test and fails only once deployed). This is below
 * the OWASP figure for PBKDF2; compensate with a 128-bit per-user salt, constant-time verification
 * and a 12-character minimum. See https://github.com/cloudflare/workerd/issues/1346.
 */
export const PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSWORD_LENGTH = 12;

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const SCHEME = "pbkdf2";
const DIGEST = "sha256";

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, KEY_BYTES * 8));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Returns `pbkdf2$sha256$100000$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return [SCHEME, DIGEST, PBKDF2_ITERATIONS, toBase64(salt), toBase64(hash)].join("$");
}

/** Verifies against a stored hash. Reads the iteration count from the record, capped at the Workers limit. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;
  const [scheme, digest, iterationsRaw, saltB64, hashB64] = parts;
  if (scheme !== SCHEME || digest !== DIGEST) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  try {
    return timingSafeEqual(await derive(password, fromBase64(saltB64 ?? ""), iterations), fromBase64(hashB64 ?? ""));
  } catch {
    return false;
  }
}

/** Human-readable policy failure, or null when the password is acceptable. */
export function passwordProblem(password: string, minLength = MIN_PASSWORD_LENGTH): string | null {
  if (password.length < minLength) return `Password must be at least ${minLength} characters.`;
  if (password.length > 256) return "Password must be at most 256 characters.";
  return null;
}

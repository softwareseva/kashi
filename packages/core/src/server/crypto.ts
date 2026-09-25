/** WebCrypto helpers for opaque tokens, hashing, HMAC and constant-time comparison. Never logs key material. */
const encoder = new TextEncoder();

/** URL-safe random token, 32 bytes by default. */
export function randomToken(bytes = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Six-digit numeric code with uniform distribution (rejection sampling). */
export function randomDigits(length = 6): string {
  let out = "";
  while (out.length < length) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]!;
    if (byte < 250) out += String(byte % 10);
  }
  return out;
}

export function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Uint8Array(decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength));
}

/** SHA-256 as base64url. Use for storing opaque tokens. */
export async function sha256(value: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

/** SHA-256 as lowercase hex. */
export async function sha256Hex(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA-256 as base64url. Use for peppered codes and signed state values. */
export async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

/** Constant-time string comparison. */
export function safeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index]! ^ b[index]!;
  return mismatch === 0;
}

/** RS256 keypair for signing federation ID tokens, kept separate from the site's own JWT_SECRET. */
import type { AuthEnv } from "../types";

export type FederationJwk = JsonWebKey & { kid: string };

function parsePrivateJwk(env: AuthEnv): FederationJwk {
  if (!env.federationPrivateKey) throw new Error("@softwareseva/auth: FEDERATION_PRIVATE_KEY is required to act as a peer issuer. Generate one with generateFederationKeypair().");
  return JSON.parse(env.federationPrivateKey) as FederationJwk;
}

export function federationPrivateJwk(env: AuthEnv): FederationJwk {
  return parsePrivateJwk(env);
}

/**
 * Strips the private fields (d, p, q, dp, dq, qi) to get the half published at the JWKS endpoint.
 * `key_ops` must also be corrected to `["verify"]` — left as the private key's `["sign"]`, WebCrypto
 * refuses to import it for verification (key_ops/usage mismatch).
 */
export function federationPublicJwk(env: AuthEnv): FederationJwk {
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, key_ops: _keyOps, ...pub } = parsePrivateJwk(env);
  return { ...pub, key_ops: ["verify"] } as FederationJwk;
}

/**
 * Generate a fresh RS256 keypair as JWKs. Run once per site (e.g. `npx tsx -e "..."`) and store the
 * private half as the `FEDERATION_PRIVATE_KEY` secret; the public half never needs to be stored —
 * it is derived from the private JWK on every JWKS request.
 */
export async function generateFederationKeypair(): Promise<{ privateJwk: FederationJwk; publicJwk: FederationJwk }> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const kid = crypto.randomUUID();
  const privateJwk = { ...(await crypto.subtle.exportKey("jwk", privateKey)), kid, alg: "RS256", use: "sig" } as FederationJwk;
  const publicJwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid, alg: "RS256", use: "sig" } as FederationJwk;
  return { privateJwk, publicJwk };
}

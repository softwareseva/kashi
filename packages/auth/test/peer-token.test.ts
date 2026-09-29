import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@softwareseva/core/server";
import { generateFederationKeypair } from "../src/server/federation/keys";
import { signFederationIdToken } from "../src/server/providers/peer-issuer";
import type { AuthConfig, AuthEnv, AuthUser } from "../src/server/types";

const issueSession = vi.fn(async (..._args: unknown[]) => ({ user: { id: "usr_1" }, accessToken: "at", refreshToken: "rt" }));
vi.mock("../src/server/session", async (orig) => ({ ...(await orig<typeof import("../src/server/session")>()), issueSession: (...a: unknown[]) => issueSession(...a) }));
vi.mock("../src/server/users", () => ({ userForIdentity: async () => ({ id: "usr_1", name: "Asha", email: null, phone: null, roles: ["user"], emailVerifiedAt: null, phoneVerifiedAt: null }) }));
vi.mock("@softwareseva/core/server", async (orig) => ({ ...(await orig<typeof import("@softwareseva/core/server")>()), rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));

const user: AuthUser = { id: "usr_1", name: "Asha", email: null, phone: null, roles: ["user"], emailVerifiedAt: null, phoneVerifiedAt: null };
const issuer = "https://issuer-native.test/v1/auth";
let fetchMock: ReturnType<typeof vi.fn>;

async function makeApp(hooks: AuthConfig["hooks"]) {
  const { authRouter } = await import("../src/server/router");
  const { privateJwk, publicJwk } = await generateFederationKeypair();
  const issuerEnv: AuthEnv = { db: null as never, jwtSecret: "x", issuer: "i", audience: "a", origins: [], appOrigin: "https://issuer.test", authUrl: issuer, secureCookies: true, federationPrivateKey: JSON.stringify(privateJwk) };
  const idToken = await signFederationIdToken(issuerEnv, "cid", user, { sid: "central_1" });
  fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).endsWith("/jwks.json") ? new Response(JSON.stringify({ keys: [publicJwk] })) : new Response(JSON.stringify({ idToken }))));
  vi.stubGlobal("fetch", fetchMock);
  const app = authRouter({ providers: { peer: { trust: [{ issuer, clientId: "cid", clientSecret: "s" }] } }, hooks });
  app.onError((error, c) => c.json({ error: String(error) }, error instanceof ApiError ? (error.status as 401 | 403) : 500));
  const post = () => app.request("/peer/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "0", code: "c" }) }, { DB: {}, JWT_SECRET: "s", AUTH_URL: "https://consumer.test/v1/auth", APP_ORIGIN: "https://app.test", WEB_ORIGIN: "https://app.test" });
  return post;
}

describe("POST /peer/token", () => {
  beforeEach(() => issueSession.mockClear());

  it("calls onFederationSession with the verified sid and the same familyId the session is issued under", async () => {
    const onFederationSession = vi.fn(async () => {});
    const res = await (await makeApp({ onFederationSession }))();
    expect(res.status).toBe(200);
    const [, claims, familyId] = onFederationSession.mock.calls[0] as unknown as [unknown, { subject: string; sessionId?: string }, string];
    expect(claims.sessionId).toBe("central_1");
    expect(issueSession.mock.calls[0]![5]).toBe(familyId);
  });

  it("fails closed: a throwing hook means no session is issued", async () => {
    const res = await (await makeApp({ onFederationSession: async () => { throw new Error("db down"); } }))();
    expect(res.status).toBe(401);
    expect(issueSession).not.toHaveBeenCalled();
  });

  it("preserves an ApiError thrown by the hook", async () => {
    const res = await (await makeApp({ onFederationSession: async () => { throw new ApiError(403, "FORBIDDEN", "no"); } }))();
    expect(res.status).toBe(403);
    expect(issueSession).not.toHaveBeenCalled();
  });
});

import { env, SELF } from "cloudflare:test";
import { hashPassword } from "@softwareseva/core/server";
import { describe, expect, it } from "vitest";

const call = (path: string, init: RequestInit = {}) => SELF.fetch(`http://example.com/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });

describe("sessions", () => {
  it("signs in, refreshes once, and detects reuse", async () => {
    await env.DB.prepare("INSERT INTO auth_users(id, display_name, email, roles, password_hash, created_at, updated_at) VALUES ('u1','U','u@example.com','[\"user\"]',?, '2026-01-01','2026-01-01')").bind(await hashPassword("correct horse battery")).run();
    const signIn = await call("/auth/password/sign-in", { method: "POST", body: JSON.stringify({ identifier: "u@example.com", password: "correct horse battery", transport: "token" }) });
    const { data } = (await signIn.json()) as { data: { refreshToken: string } };
    expect((await call("/auth/token/refresh", { method: "POST", body: JSON.stringify({ refreshToken: data.refreshToken }) })).status).toBe(200);
    const reuse = await call("/auth/token/refresh", { method: "POST", body: JSON.stringify({ refreshToken: data.refreshToken }) });
    expect(((await reuse.json()) as { code: string }).code).toBe("TOKEN_REUSE");
  });
});

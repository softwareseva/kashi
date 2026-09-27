/** Auth configuration for this app: providers, the OTP sender, and hooks. Shared by the router and route guards. */
import type { AuthConfig, AuthEnv } from "@softwareseva/auth/server";
import { nowIso } from "@softwareseva/core/server";
import type { Context } from "hono";

/** Outside production, codes go to the dev_outbox table instead of a messaging provider. */
async function sendCode(env: AuthEnv, destination: string, code: string, c: Context) {
  const environment = (c.env as { ENVIRONMENT?: string }).ENVIRONMENT;
  if (environment !== "production") {
    await env.db.prepare("INSERT INTO dev_outbox(destination, body, created_at) VALUES (?, ?, ?)").bind(destination, code, nowIso()).run();
    return;
  }
  // Production: call your WhatsApp/SMS provider here (see the auth-whatsapp-otp skill for an AiSensy adapter).
  throw new Error("No OTP sender configured for production.");
}

export const authConfig: AuthConfig = {
  defaultRoles: ["user"],
  providers: {
    password: true,
    otp: { channel: "phone", send: sendCode, defaultCountry: "IN" },
    google: {},
    apple: {},
    facebook: {},
    passkeys: {},
    peer: {
      issuer: { enabled: true },
      // Self-federation, for local dev and the integration test only: this example trusts its own
      // AUTH_URL, so the whole register -> approve -> authorize -> token -> callback loop can be
      // exercised end-to-end against one worker (see test/integration/federation.test.ts). A real
      // deployment points `issuer` at *another* kashi site's AUTH_URL, with a clientId/clientSecret
      // obtained from that site's admin after they approve the registration — see the
      // auth-federation skill.
      trust: [
        { issuer: "http://example.com/v1/auth", clientId: "fedcli_test", clientSecret: "test-secret-value", label: "self" },
        // Second self-trust entry with sign-up disabled, purely to exercise that branch in the
        // integration test (see test/integration/federation.test.ts) — a real deployment would use
        // this on a peer whose users should never auto-provision an account here.
        { issuer: "http://example.com/v1/auth", clientId: "fedcli_test_nosignup", clientSecret: "test-secret-value-2", label: "self-nosignup", allowSignUp: false },
      ],
    },
  },
};

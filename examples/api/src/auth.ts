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
    passkeys: {},
  },
};

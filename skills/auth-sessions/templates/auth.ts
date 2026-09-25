/** Auth configuration for this app. Import it wherever you mount the router or guard a route. */
import type { AuthConfig, AuthEnv } from "@kashi/auth/server";
import type { Context } from "hono";

async function sendCode(env: AuthEnv, destination: string, code: string, c: Context) {
  // Replace with your provider; see the auth-whatsapp-otp skill (templates/aisensy.ts, templates/meta-whatsapp.ts).
  void env; void destination; void code; void c;
  throw new Error("OTP sender not configured");
}

export const authConfig: AuthConfig = {
  defaultRoles: ["user"],
  providers: {
    password: false,
    otp: { channel: "phone", send: sendCode, defaultCountry: "IN" },
    google: {},
    apple: {},
    passkeys: {},
  },
  hooks: {
    onUserCreated: async (user) => { void user; /* create profile rows here */ },
  },
};

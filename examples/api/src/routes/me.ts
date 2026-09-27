/** Example protected routes: any signed-in user (including anonymous, passkey-only accounts), admins only, and an action that needs a valid id. */
import { Hono } from "hono";
import { ok } from "@softwareseva/core/server";
import { requireAuth, requireRole, requireVerified, type AuthVariables } from "@softwareseva/auth/server";
import { authConfig } from "../auth";
import type { Bindings } from "../types";

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>()
  .get("/", requireAuth(authConfig), (c) => ok(c, { id: c.get("user").id, name: c.get("user").name }))
  .get("/admin", requireRole(authConfig, "admin"), (c) => ok(c, { admin: true }))
  // An anonymous, passkey-only account can sign in and use most of the app, but this one needs a
  // reachable identity (OTP-verified email/phone, or a linked Google/Apple/Facebook sign-in).
  .get("/payout-details", requireVerified(authConfig), (c) => ok(c, { verified: true }));

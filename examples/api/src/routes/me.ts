/** Example protected routes: any signed-in user, and admins only. */
import { Hono } from "hono";
import { ok } from "@softwareseva/core/server";
import { requireAuth, requireRole, type AuthVariables } from "@softwareseva/auth/server";
import { authConfig } from "../auth";
import type { Bindings } from "../types";

export const meRoutes = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>()
  .get("/", requireAuth(authConfig), (c) => ok(c, { id: c.get("user").id, name: c.get("user").name }))
  .get("/admin", requireRole(authConfig, "admin"), (c) => ok(c, { admin: true }));

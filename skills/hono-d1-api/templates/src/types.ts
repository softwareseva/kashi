/** Worker bindings and per-request variables. Every route, service and repository imports AppEnv from here. */
import type { CoreVariables } from "@kashi/core/server";

export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: string;
  WEB_ORIGIN: string;
  // secrets (wrangler secret put / .dev.vars) go here too, e.g. JWT_SECRET: string;
}

export type AppEnv = { Bindings: Bindings; Variables: CoreVariables };

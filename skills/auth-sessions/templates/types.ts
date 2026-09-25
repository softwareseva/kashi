/** Bindings and variables: add AuthVariables so c.get("user") is typed on guarded routes. */
import type { AuthVariables } from "@softwareseva/auth/server";
import type { CoreVariables } from "@softwareseva/core/server";

export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: string;
  WEB_ORIGIN: string;
  JWT_SECRET: string;
  OTP_PEPPER?: string;
}

export type AppEnv = { Bindings: Bindings; Variables: CoreVariables & Partial<AuthVariables> };

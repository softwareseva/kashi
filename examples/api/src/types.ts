/** Worker bindings and per-request variables. Every route, service and repository imports AppEnv from here. */
import type { AuthVariables } from "@softwareseva/auth/server";
import type { CoreVariables } from "@softwareseva/core/server";

export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: string;
  WEB_ORIGIN: string;
  JWT_SECRET: string;
  OTP_PEPPER: string;
  RP_ID?: string;
}

export type AppEnv = { Bindings: Bindings; Variables: CoreVariables & Partial<AuthVariables> };

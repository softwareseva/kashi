/** Hono app factory: request ids, security headers, CORS, health route, envelope error handling. */
import { Hono, type Env } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { ApiError } from "./http";

export type CoreVariables = { requestId: string };
export type CoreEnv = { Bindings: Record<string, unknown>; Variables: CoreVariables };

export type CreateAppOptions<E extends Env> = {
  /** Allowed browser origins, resolved per request so they can come from env vars. */
  origins?: (env: E["Bindings"]) => string[];
  /** Extra request headers browsers may send. `Content-Type`, `Authorization` and `X-CSRF-Token` are always allowed. */
  allowHeaders?: string[];
  /** Path prefix that gets CORS (default `/v1/*`). */
  corsPath?: string;
  /** Health route path (default `/health`); set `null` to disable. */
  healthPath?: string | null;
  /** Called for unexpected errors before the 500 response; defaults to a JSON console.error line. */
  onUnexpectedError?: (error: Error, requestId: string) => void;
};

/**
 * Build the composition root. Mount feature routers with `app.route("/v1/auth", authRouter(...))`.
 *
 * - Every request gets a `requestId` variable (Cloudflare's `CF-Ray` or a UUID) echoed as `X-Request-Id`.
 * - `ApiError` becomes its status with `{ code, message, requestId, fields? }`.
 * - `ZodError` becomes 422 `VALIDATION_ERROR` with `fields`.
 * - Anything else becomes 500 `INTERNAL_ERROR` and is logged with the request id, never with its stack in the body.
 */
export function createApp<E extends Env & { Variables: CoreVariables }>(options: CreateAppOptions<E> = {}): Hono<E> {
  const app = new Hono<E>();
  const healthPath = options.healthPath === undefined ? "/health" : options.healthPath;

  app.use("*", async (c, next) => {
    c.set("requestId", c.req.header("CF-Ray") ?? crypto.randomUUID());
    await next();
    c.header("X-Request-Id", c.get("requestId"));
  });
  app.use("*", secureHeaders({ strictTransportSecurity: "max-age=31536000; includeSubDomains" }));
  if (options.origins) {
    const origins = options.origins;
    app.use(options.corsPath ?? "/v1/*", cors({
      origin: (origin, c) => (origins(c.env).includes(origin) ? origin : ""),
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", ...(options.allowHeaders ?? [])],
      exposeHeaders: ["X-Request-Id"],
    }));
  }
  if (healthPath) app.get(healthPath, (c) => c.json({ status: "ok" }));

  app.notFound((c) => c.json({ code: "NOT_FOUND", message: "Resource not found.", requestId: c.get("requestId") }, 404));
  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    if (error instanceof ApiError) {
      return c.json({ code: error.code, message: error.message, requestId, ...(error.fields ? { fields: error.fields } : {}) }, error.status);
    }
    if (error instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        (fields[key] ??= []).push(issue.message);
      }
      return c.json({ code: "VALIDATION_ERROR", message: "The request is invalid.", fields, requestId }, 422);
    }
    (options.onUnexpectedError ?? defaultLog)(error, requestId);
    return c.json({ code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId }, 500);
  });
  return app;
}

function defaultLog(error: Error, requestId: string) {
  console.error(JSON.stringify({ level: "error", requestId, name: error.name, message: error.message }));
}

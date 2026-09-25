/** Outside production, write codes to dev_outbox instead of sending them. Pair with templates/dev-outbox.sql. */
import type { AuthEnv } from "@softwareseva/auth/server";
import { nowIso } from "@softwareseva/core/server";
import type { Context } from "hono";

export function withDevOutbox(send: (env: AuthEnv, destination: string, code: string, c: Context) => Promise<void>) {
  return async (env: AuthEnv, destination: string, code: string, c: Context) => {
    if ((c.env as { ENVIRONMENT?: string }).ENVIRONMENT === "production") return send(env, destination, code, c);
    await env.db.prepare("INSERT INTO dev_outbox(destination, body, created_at) VALUES (?, ?, ?)").bind(destination, code, nowIso()).run();
  };
}

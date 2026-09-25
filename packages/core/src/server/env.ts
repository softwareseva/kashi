/** Fail fast when a Worker is missing bindings or secrets, with a message that names them. */
import type { ZodType } from "zod";

/** Validate `c.env` once per isolate; throws a plain Error listing the missing or invalid keys. */
export function parseEnv<T>(schema: ZodType<T>, env: unknown): T {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  const missing = result.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`);
  throw new Error(`Invalid Worker environment. Set the following with wrangler vars or secrets:\n  ${missing.join("\n  ")}`);
}

/** Cheap check for a list of required string keys when a schema is overkill. */
export function requireEnv<K extends string>(env: Record<string, unknown>, keys: readonly K[]): Record<K, string> {
  const missing = keys.filter((key) => typeof env[key] !== "string" || env[key] === "");
  if (missing.length) throw new Error(`Missing Worker secrets or vars: ${missing.join(", ")}. Use 'wrangler secret put' or .dev.vars.`);
  return env as Record<K, string>;
}

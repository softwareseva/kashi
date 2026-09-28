/** Fixed-window rate limiting backed by the `rate_limits` D1 table (migration core_0001). */
import type { Context, Next } from "hono";
import { ApiError, clientIp } from "./http";

export type RateLimitOptions = {
  /** Namespace for the counter, e.g. "otp-send". */
  scope: string;
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Identity to count by; defaults to the client IP. Return null to skip limiting for this request. */
  key?: (c: Context) => string | null | Promise<string | null>;
  /** D1 binding; defaults to `c.env.DB`. */
  db?: (c: Context) => D1Database;
  /** Error shown to the client. */
  message?: string;
};

/**
 * Counts one hit; throws ApiError 429 `RATE_LIMITED` when the window is exhausted. Usable from services.
 *
 * The read-and-increment happens in a single UPSERT with RETURNING so concurrent callers for the
 * same key can't both read a count below the limit and both be admitted (nor both reset an expired
 * window and land two separate "first hit" counters).
 */
export async function consumeRateLimit(db: D1Database, key: string, limit: number, windowSeconds: number, message = "Too many attempts. Please try again later."): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(
    `INSERT INTO rate_limits(key, count, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE count + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END
     RETURNING count`,
  ).bind(key, now, now, windowSeconds, now, windowSeconds, now).first<{ count: number }>();
  if (!row || row.count > limit) throw new ApiError(429, "RATE_LIMITED", message);
}

/** Hono middleware form: `app.post("/otp", rateLimit({ scope: "otp", limit: 5, windowSeconds: 900 }), handler)`. */
export function rateLimit(options: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const identity = options.key ? await options.key(c) : clientIp(c);
    if (identity !== null) {
      const db = options.db ? options.db(c) : (c.env as { DB: D1Database }).DB;
      await consumeRateLimit(db, `${options.scope}:${identity}`, options.limit, options.windowSeconds, options.message);
    }
    await next();
  };
}

/** Delete counters whose window ended more than `olderThanSeconds` ago. Call from a cron trigger. */
export async function pruneRateLimits(db: D1Database, olderThanSeconds = 86_400): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE window_started_at < ?").bind(Math.floor(Date.now() / 1000) - olderThanSeconds).run();
}

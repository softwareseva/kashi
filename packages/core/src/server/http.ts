/** Error type, success envelope and small request helpers shared by every kashi route. */
import type { Context } from "hono";

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 429 | 500 | 502 | 503;
export type FieldErrors = Record<string, string[]>;

/** Expected API failure. The app factory turns it into `{ code, message, requestId, fields? }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: ErrorStatus,
    public readonly code: string,
    message: string,
    public readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiFailure = { code: string; message: string; requestId: string; fields?: FieldErrors };
export type ApiSuccess<T> = { data: T };

/** `{ data }` success envelope. */
export function ok<T>(c: Context, data: T, status: 200 | 201 | 202 = 200) {
  return c.json({ data } satisfies ApiSuccess<T>, status);
}

/** Client IP as seen by Cloudflare; "unknown" outside the edge. */
export function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "unknown";
}

export const nowIso = (): string => new Date().toISOString();
export const futureIso = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();
export const nowUnix = (): number => Math.floor(Date.now() / 1000);

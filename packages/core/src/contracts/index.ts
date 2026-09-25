/** @kashi/core/contracts — the response envelope every kashi API and client agrees on. */
import { z } from "zod";

export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()));
export const apiFailureSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  fields: fieldErrorsSchema.optional(),
});
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiSuccess<T> = { data: T };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const isApiFailure = (value: unknown): value is ApiFailure => apiFailureSchema.safeParse(value).success;

/** Standard error codes emitted by kashi packages. Apps add their own. */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INVALID_CURSOR: "INVALID_CURSOR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

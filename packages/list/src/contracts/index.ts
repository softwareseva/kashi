/** @softwareseva/list/contracts — list query parameters and page shapes shared by server and clients. */
import { z } from "zod";

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export type ListQueryOptions<S extends string> = {
  defaultSort?: S;
  defaultDirection?: SortDirection;
  defaultLimit?: number;
  maxLimit?: number;
  maxQueryLength?: number;
};

/**
 * Query-string schema for a keyset list: `q`, `sort`, `direction`, `limit`, `cursor`.
 * `sortKeys` is the allowlist; anything else is a 422. Use with `c.req.query()`.
 */
export function listQuerySchema<const S extends readonly [string, ...string[]]>(sortKeys: S, options: ListQueryOptions<S[number]> = {}) {
  return z.object({
    q: z.string().trim().max(options.maxQueryLength ?? 200).default(""),
    sort: z.enum(sortKeys as unknown as [S[number], ...S[number][]]).default(options.defaultSort ?? sortKeys[0]),
    direction: sortDirectionSchema.default(options.defaultDirection ?? "asc"),
    limit: z.coerce.number().int().min(1).max(options.maxLimit ?? 100).default(options.defaultLimit ?? 25),
    cursor: z.string().max(500).optional(),
  });
}
export type ListQuery<S extends string = string> = { q: string; sort: S; direction: SortDirection; limit: number; cursor?: string };

/** Keyset page: opaque cursors, no total (counting is a separate, optional query). */
export type Page<T> = { items: T[]; next: string | null; previous: string | null };

/** Offset page for small admin lists where a total is wanted. */
export function offsetQuerySchema(options: { defaultPageSize?: number; maxPageSize?: number; maxQueryLength?: number } = {}) {
  return z.object({
    q: z.string().trim().max(options.maxQueryLength ?? 200).default(""),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(options.maxPageSize ?? 100).default(options.defaultPageSize ?? 20),
  });
}
export type OffsetPage<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

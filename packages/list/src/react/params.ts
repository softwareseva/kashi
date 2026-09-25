/** Pure URL-parameter transitions for directory screens. Every change except paging clears the cursor. */
import type { SortDirection } from "../contracts/index";

export type DirectoryDefaults<S extends string> = { sort: S; direction?: SortDirection; limit?: number; sortKeys?: readonly S[]; limits?: readonly number[] };
export type DirectoryQuery<S extends string> = { q: string; sort: S; direction: SortDirection; limit: number; cursor?: string };

export function readDirectory<S extends string>(params: URLSearchParams, d: DirectoryDefaults<S>): DirectoryQuery<S> {
  const rawSort = params.get("sort") as S | null;
  const sort = rawSort && (!d.sortKeys || d.sortKeys.includes(rawSort)) ? rawSort : d.sort;
  const direction: SortDirection = params.get("direction") === "desc" ? "desc" : params.get("direction") === "asc" ? "asc" : d.direction ?? "asc";
  const limits = d.limits ?? [10, 25, 50, 100];
  const rawLimit = Number(params.get("limit"));
  const limit = limits.includes(rawLimit) ? rawLimit : d.limit ?? 25;
  const cursor = params.get("cursor") ?? undefined;
  return { q: params.get("q") ?? "", sort, direction, limit, ...(cursor ? { cursor } : {}) };
}

const edit = (params: URLSearchParams, fn: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); fn(next); return next; };

/** Clicking the active column flips direction; a new column starts ascending. */
export const withSort = <S extends string>(params: URLSearchParams, key: S, d: DirectoryDefaults<S>) => {
  const current = readDirectory(params, d);
  return edit(params, (n) => { n.set("sort", key); n.set("direction", current.sort === key && current.direction === "asc" ? "desc" : "asc"); n.delete("cursor"); });
};
export const withSearch = (params: URLSearchParams, q: string) => edit(params, (n) => { q.trim() ? n.set("q", q.trim()) : n.delete("q"); n.delete("cursor"); });
export const withLimit = (params: URLSearchParams, limit: number) => edit(params, (n) => { n.set("limit", String(limit)); n.delete("cursor"); });
export const withFilter = (params: URLSearchParams, name: string, value: string | null) => edit(params, (n) => { value ? n.set(name, value) : n.delete(name); n.delete("cursor"); });
export const withCursor = (params: URLSearchParams, cursor: string | null) => edit(params, (n) => { cursor ? n.set("cursor", cursor) : n.delete("cursor"); });

/** Query string for the API call, dropping empty values. */
export function toQueryString(q: Record<string, string | number | undefined | null>): string {
  return new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();
}

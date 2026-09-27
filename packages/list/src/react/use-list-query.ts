/** One TanStack Query hook per directory resource: combines useDirectory's URL state with a keyset-paginated fetch, keeping the table visible across page/sort/search changes via keepPreviousData. */
import { keepPreviousData } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useApiQuery, type ApiError } from "@softwareseva/core/react";
import type { ApiClient } from "@softwareseva/core/client";
import { useDirectory, type Directory, type SearchParamsPair } from "./use-directory";
import { toQueryString, type DirectoryDefaults } from "./params";
import type { Page } from "../contracts/index";

export type ListQueryOptions = {
  /** e.g. `/notes`. Appended with `?${toQueryString(dir.query)}`. */
  path: string;
  /** Query key prefix; the current directory query is appended so each filter/sort/page combination caches separately. */
  queryKey: string;
};

export type ListQueryResult<T, S extends string> = {
  dir: Directory<S>;
  query: UseQueryResult<Page<T>, ApiError>;
};

/**
 * ```tsx
 * const useNotesQuery = createListQuery<Note, "updatedAt" | "title">(api, { path: "/notes", queryKey: "notes" });
 * const { dir, query } = useNotesQuery(useSearchParams(), { sort: "updatedAt", direction: "desc", sortKeys: ["updatedAt", "title"] });
 * <DataTable rows={query.data?.items ?? []} loading={query.isFetching} sort={dir.sort} direction={dir.direction} onSort={dir.setSort} ... />
 * ```
 */
export function createListQuery<T, S extends string>(api: ApiClient, options: ListQueryOptions) {
  return function useListQuery(pair: SearchParamsPair, defaults: DirectoryDefaults<S>): ListQueryResult<T, S> {
    const dir = useDirectory(pair, defaults);
    const query = useApiQuery<Page<T>>({
      queryKey: [options.queryKey, dir.query],
      queryFn: () => api.get<Page<T>>(`${options.path}?${toQueryString(dir.query)}`),
      placeholderData: keepPreviousData,
    });
    return { dir, query };
  };
}

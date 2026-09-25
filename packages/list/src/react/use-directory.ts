/** Directory state in the URL: works with any router through a [params, setParams] pair. */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { type DirectoryDefaults, type DirectoryQuery, readDirectory, withCursor, withFilter, withLimit, withSearch, withSort } from "./params";

export type SearchParamsPair = readonly [URLSearchParams, (next: URLSearchParams) => void];

export type Directory<S extends string> = DirectoryQuery<S> & {
  params: URLSearchParams;
  /** Column click handler for DataTable `onSort`. */
  setSort: (key: S) => void;
  setSearch: (q: string) => void;
  setLimit: (limit: number) => void;
  setFilter: (name: string, value: string | null) => void;
  /** Pass `page.next` or `page.previous`. */
  goTo: (cursor: string | null) => void;
  /** Values for the API call: `api.get(\`/notes?${toQueryString(dir.query)}\`)`. */
  query: DirectoryQuery<S>;
};

/**
 * ```tsx
 * const dir = useDirectory(useSearchParams(), { sort: "updatedAt", direction: "desc", sortKeys: ["updatedAt", "title"] }); // react-router
 * const dir = useDirectory(useUrlSearchParams(), defaults);                                                               // no router
 * ```
 */
export function useDirectory<S extends string>(pair: SearchParamsPair, defaults: DirectoryDefaults<S>): Directory<S> {
  const [params, setParams] = pair;
  const query = useMemo(() => readDirectory(params, defaults), [params, defaults.sort, defaults.direction, defaults.limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSort = useCallback((key: S) => setParams(withSort(params, key, defaults)), [params, setParams, defaults]);
  const setSearch = useCallback((q: string) => setParams(withSearch(params, q)), [params, setParams]);
  const setLimit = useCallback((limit: number) => setParams(withLimit(params, limit)), [params, setParams]);
  const setFilter = useCallback((name: string, value: string | null) => setParams(withFilter(params, name, value)), [params, setParams]);
  const goTo = useCallback((cursor: string | null) => setParams(withCursor(params, cursor)), [params, setParams]);
  return { ...query, params, setSort, setSearch, setLimit, setFilter, goTo, query };
}

const subscribe = (cb: () => void) => { window.addEventListener("popstate", cb); window.addEventListener("kashi:urlchange", cb); return () => { window.removeEventListener("popstate", cb); window.removeEventListener("kashi:urlchange", cb); }; };

/** Minimal search-params pair on `window.history` for apps without a router. */
export function useUrlSearchParams(): SearchParamsPair {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback((next: URLSearchParams) => {
    const qs = next.toString();
    window.history.pushState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    window.dispatchEvent(new Event("kashi:urlchange"));
  }, []);
  return [params, set] as const;
}

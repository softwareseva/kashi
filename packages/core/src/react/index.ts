/** @softwareseva/core/react — TanStack Query bindings shared by every kashi React package: typed ApiError on query/mutation results and a QueryClient tuned for the shared-refresh-once ApiClient. */

import {
  useMutation,
  useQuery,
  QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "../client/index.js";

export function useApiQuery<TData, TKey extends QueryKey = QueryKey>(
  options: UseQueryOptions<TData, ApiError, TData, TKey>,
): UseQueryResult<TData, ApiError> {
  return useQuery(options);
}

export function useApiMutation<TData, TVariables = void>(
  options: UseMutationOptions<TData, ApiError, TVariables>,
): UseMutationResult<TData, ApiError, TVariables> {
  return useMutation(options);
}

/** A 401/403 from `createApiClient` has already gone through its single shared refresh-and-retry; retrying again at the Query layer just repeats the same failure. */
function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function createQueryClient(options?: { defaultStaleTimeMs?: number }): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options?.defaultStaleTimeMs ?? 30_000,
        retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export { ApiError };

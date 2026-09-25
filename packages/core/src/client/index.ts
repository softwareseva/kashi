/** @kashi/core/client — fetch wrapper that unwraps the envelope, throws ApiError and refreshes a session once on 401. */

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClientOptions = {
  /** e.g. `https://api.example.com/v1` (no trailing slash). */
  baseUrl: string;
  /** `include` for cookie sessions (default), `same-origin` or `omit` for bearer tokens. */
  credentials?: RequestCredentials;
  /** Headers added to every request, e.g. a bearer token or locale. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Refresh the session; resolve true when the original request should be retried. Runs at most once per 401 burst. */
  refresh?: () => Promise<boolean>;
  /** Paths that must never trigger a refresh (default: anything under `/auth`). */
  isAuthPath?: (path: string) => boolean;
  /** Called when a 401 could not be recovered, e.g. to route to sign-in. */
  onUnauthorized?: () => void;
  /** Translate messages by code before they reach the UI. */
  translate?: (code: string, fallback: string) => string;
  fetch?: typeof fetch;
};

export type ApiClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const isAuthPath = options.isAuthPath ?? ((path) => path.startsWith("/auth"));
  let refreshing: Promise<boolean> | null = null;

  const refreshOnce = () => {
    if (!options.refresh) return Promise.resolve(false);
    refreshing ??= options.refresh().catch(() => false).finally(() => { refreshing = null; });
    return refreshing;
  };

  async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const extra = options.headers ? await options.headers() : {};
    const isForm = init.body instanceof FormData;
    const response = await doFetch(`${options.baseUrl}${path}`, {
      ...init,
      credentials: options.credentials ?? "include",
      headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...extra, ...(init.headers as Record<string, string> | undefined) },
    });
    if (response.status === 401 && retry && !isAuthPath(path) && (await refreshOnce())) return request<T>(path, init, false);
    if (response.status === 204) return undefined as T;
    const payload = (await response.json().catch(() => null)) as { data?: T; code?: string; message?: string; fields?: Record<string, string[]>; requestId?: string } | null;
    if (!response.ok || !payload || !("data" in payload)) {
      const code = payload?.code ?? "REQUEST_FAILED";
      const fallback = payload?.message ?? `Request failed (${response.status}).`;
      if (response.status === 401) options.onUnauthorized?.();
      throw new ApiError(code, options.translate ? options.translate(code, fallback) : fallback, response.status, payload?.fields, payload?.requestId);
    }
    return payload.data as T;
  }

  const withBody = (method: string) => <T>(path: string, body?: unknown, init: RequestInit = {}) =>
    request<T>(path, { ...init, method, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });

  return {
    request: (path, init) => request(path, init),
    get: (path, init) => request(path, { ...init, method: "GET" }),
    post: withBody("POST"),
    put: withBody("PUT"),
    patch: withBody("PATCH"),
    delete: (path, init) => request(path, { ...init, method: "DELETE" }),
  };
}

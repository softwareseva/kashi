/** The one API client for this app. Cookie sessions; refresh once on 401; send the user to sign-in when that fails. */
import { createApiClient } from "@softwareseva/core/client";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "/v1",
  credentials: "include",
  refresh: async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? "/v1"}/auth/refresh`, { method: "POST", credentials: "include" });
    return res.ok;
  },
  onUnauthorized: () => {
    if (!location.pathname.startsWith("/sign-in")) location.assign(`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`);
  },
});

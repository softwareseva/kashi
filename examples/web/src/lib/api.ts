/** The one API client for this app. Cookie sessions; refresh once on 401. */
import { createApiClient } from "@softwareseva/core/client";

const baseUrl = import.meta.env.VITE_API_URL ?? "/v1";

export const api = createApiClient({
  baseUrl,
  refresh: async () => (await fetch(`${baseUrl}/auth/refresh`, { method: "POST", credentials: "include" })).ok,
});

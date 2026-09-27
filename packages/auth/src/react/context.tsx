/** AuthProvider + useAuth: session state for React apps talking to @softwareseva/auth/server over cookies, backed by TanStack Query. */
import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@softwareseva/core/react";
import type { ApiClient } from "@softwareseva/core/client";
import type { AuthConfigResponse, AuthUser, SessionResponse } from "../contracts/index";

export type AuthStatus = "loading" | "signed-out" | "signed-in";
export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  providers: AuthConfigResponse["providers"] | null;
  /** Re-fetch `/me`; call after any sign-in that did not go through the provider's helpers. */
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Store a session response (from any sign-in call) as the current user. */
  setSession: (session: SessionResponse) => void;
  api: ApiClient;
  /** Mount path of the auth router, default `/auth`. */
  basePath: string;
};

type AuthProviderValue = { api: ApiClient; basePath: string };
const AuthContext = createContext<AuthProviderValue | null>(null);

export function AuthProvider({ api, basePath = "/auth", children }: { api: ApiClient; basePath?: string; children: ReactNode }) {
  return <AuthContext.Provider value={{ api, basePath }}>{children}</AuthContext.Provider>;
}

const sessionKey = (basePath: string) => ["auth", basePath, "session"] as const;
const configKey = (basePath: string) => ["auth", basePath, "config"] as const;

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  const { api, basePath } = ctx;
  const queryClient = useQueryClient();

  const session = useApiQuery<AuthUser | null>({
    queryKey: sessionKey(basePath),
    queryFn: async () => {
      try {
        const { user } = await api.get<{ user: AuthUser }>(`${basePath}/me`);
        return user;
      } catch {
        return null;
      }
    },
  });
  const config = useApiQuery<AuthConfigResponse["providers"] | null>({
    queryKey: configKey(basePath),
    queryFn: async () => {
      try {
        const { providers } = await api.get<AuthConfigResponse>(`${basePath}/config`);
        return providers;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });

  return {
    status: session.isLoading ? "loading" : session.data ? "signed-in" : "signed-out",
    user: session.data ?? null,
    providers: config.data ?? null,
    api,
    basePath,
    reload: async () => { await queryClient.invalidateQueries({ queryKey: sessionKey(basePath) }); },
    setSession: (sessionResponse) => { queryClient.setQueryData(sessionKey(basePath), sessionResponse.user); },
    signOut: async () => {
      await api.post(`${basePath}/logout`).catch(() => undefined);
      queryClient.setQueryData(sessionKey(basePath), null);
    },
  };
}

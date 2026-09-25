/** AuthProvider + useAuth: session state for React apps talking to @kashi/auth/server over cookies. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiClient } from "@kashi/core/client";
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ api, basePath = "/auth", children }: { api: ApiClient; basePath?: string; children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [providers, setProviders] = useState<AuthConfigResponse["providers"] | null>(null);

  const reload = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: AuthUser }>(`${basePath}/me`);
      setUser(user); setStatus("signed-in");
    } catch {
      setUser(null); setStatus("signed-out");
    }
  }, [api, basePath]);

  useEffect(() => {
    void reload();
    api.get<AuthConfigResponse>(`${basePath}/config`).then((c) => setProviders(c.providers)).catch(() => setProviders(null));
  }, [api, basePath, reload]);

  const value = useMemo<AuthContextValue>(() => ({
    status, user, providers, reload, api, basePath,
    setSession: (session) => { setUser(session.user); setStatus("signed-in"); },
    signOut: async () => { await api.post(`${basePath}/logout`).catch(() => undefined); setUser(null); setStatus("signed-out"); },
  }), [status, user, providers, reload, api, basePath]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

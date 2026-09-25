/** Sign-in actions as hooks. Each returns `{ run, pending, error }` and stores the session on success. */
import { useCallback, useState } from "react";
import { ApiError } from "@kashi/core/client";
import type { SessionResponse } from "../contracts/index";
import { useAuth } from "./context";

type Action<A extends unknown[]> = { run: (...args: A) => Promise<boolean>; pending: boolean; error: ApiError | null; reset: () => void };

function useAction<A extends unknown[]>(fn: (...args: A) => Promise<SessionResponse | void>): Action<A> {
  const { setSession } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async (...args: A) => {
    setPending(true); setError(null);
    try {
      const session = await fn(...args);
      if (session) setSession(session);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("REQUEST_FAILED", e instanceof Error ? e.message : "Something went wrong.", 0));
      return false;
    } finally { setPending(false); }
  }, [fn, setSession]);
  return { run, pending, error, reset: () => setError(null) };
}

export function usePasswordSignIn() {
  const { api, basePath } = useAuth();
  return useAction((identifier: string, password: string) => api.post<SessionResponse>(`${basePath}/password/sign-in`, { identifier, password }));
}

export function useOtp() {
  const { api, basePath } = useAuth();
  const request = useAction((destination: string) => api.post<void>(`${basePath}/otp/request`, { destination }).then(() => undefined));
  const verify = useAction((destination: string, code: string, name?: string) => api.post<SessionResponse>(`${basePath}/otp/verify`, { destination, code, name }));
  return { request, verify };
}

/** Discoverable passkey sign-in. Requires @simplewebauthn/browser. */
export function usePasskeySignIn() {
  const { api, basePath } = useAuth();
  return useAction(async () => {
    const { startAuthentication } = await import("@simplewebauthn/browser");
    const start = await api.post<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId: string }>(`${basePath}/passkeys/authenticate/options`, {});
    const response = await startAuthentication({ optionsJSON: start.options });
    return api.post<SessionResponse>(`${basePath}/passkeys/authenticate/verify`, { challengeId: start.challengeId, response });
  });
}

/** Register a passkey for the signed-in user. */
export function usePasskeyRegister() {
  const { api, basePath } = useAuth();
  return useAction(async (deviceName = defaultDeviceName()) => {
    const { startRegistration } = await import("@simplewebauthn/browser");
    const start = await api.post<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; challengeId: string }>(`${basePath}/passkeys/register/options`, {});
    const response = await startRegistration({ optionsJSON: start.options });
    await api.post(`${basePath}/passkeys/register/verify`, { challengeId: start.challengeId, response, deviceName });
  });
}

/** URL that starts the OAuth code flow; render as a plain link so the browser navigates. */
export function useOAuthUrl(provider: "google" | "apple", next = "/") {
  const { basePath } = useAuth();
  return `${basePath}/${provider}/start?next=${encodeURIComponent(next)}`;
}

/** Reads `?error=CODE` left by an OAuth callback redirect. */
export function oauthErrorFromLocation(search = typeof window !== "undefined" ? window.location.search : ""): string | null {
  return new URLSearchParams(search).get("error");
}

function defaultDeviceName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone or iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

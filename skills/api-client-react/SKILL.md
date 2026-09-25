---
name: api-client-react
description: Call a kashi (Hono + D1) API from React with @kashi/core/client and @kashi/auth/react, with one fetch client that unwraps the { data } envelope, throws typed ApiError, refreshes the session once on 401, plus AuthProvider, useAuth, sign-in components, and the TanStack Query hook-per-resource convention. Use when setting up data fetching or sign-in in a React app, adding a query or mutation hook, or handling API errors and field validation messages in forms.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@kashi/core@0.1 @kashi/auth@0.1"
---

# React API client and auth

## Setup

1. `pnpm add @kashi/core @kashi/auth @kashi/ui @tanstack/react-query @simplewebauthn/browser`.
2. Copy `templates/api.ts` to `src/lib/api.ts`. It creates one client: cookie credentials, refresh through `POST /auth/refresh`, and redirect to `/sign-in` when refresh fails.
3. Wrap the app (`templates/main.tsx`): `QueryClientProvider` then `AuthProvider api={api}`.
4. Guard routes with `useAuth().status` (`"loading" | "signed-in" | "signed-out"`), see `templates/require-auth.tsx`.

In development, proxy `/v1` to the Worker (`vite.config.ts` `server.proxy`), so cookies are same-origin and CORS is not involved.

## Calling the API

```ts
const note = await api.get<Note>(`/notes/${id}`);
await api.post<Note>("/notes", { title });
```

Every method returns the unwrapped `data` or throws `ApiError { code, message, status, fields?, requestId? }`. Show `error.fields?.title?.[0]` next to the field and `error.message` otherwise. Never parse error text; branch on `code`.

## One hook per resource

Keep query keys and fetchers together (`templates/use-notes.ts`):

```ts
export const noteKeys = { all: ["notes"] as const, list: (q: ListParams) => [...noteKeys.all, "list", q] as const, one: (id: string) => [...noteKeys.all, id] as const };
export const useNotes = (q: ListParams) => useQuery({ queryKey: noteKeys.list(q), queryFn: () => api.get<Page<Note>>(`/notes?${toSearch(q)}`), placeholderData: keepPreviousData });
export const useCreateNote = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (b: NewNote) => api.post<Note>("/notes", b), onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }) }); };
```

Pages import hooks, never `api` directly. For lists, pair with the `react-data-table` skill.

## Sign-in UI

`<SignIn next="/app" onSuccess={() => navigate("/app")} />` renders every provider the server reports via `/auth/config`: passkey button, Google, Apple, OTP (with password as an alternative when both are on). Compose `PasskeyButton`, `OAuthButton`, `OtpSignIn`, `PasswordSignIn` for custom layouts, or use the hooks (`useOtp`, `usePasskeySignIn`, `usePasswordSignIn`, `usePasskeyRegister`) with your own markup. Error codes map to messages with `authMessage(code)`.

## Tailwind

`@kashi/auth/react` components use `@kashi/ui` classes. Add both packages to Tailwind's sources:

```css
@source "../node_modules/@kashi/ui/dist";
@source "../node_modules/@kashi/auth/dist/react";
```

---
name: api-client-react
description: Call a kashi (Hono + D1) API from React with @softwareseva/core/client and @softwareseva/auth/react, with one fetch client that unwraps the { data } envelope, throws typed ApiError, refreshes the session once on 401, plus AuthProvider, useAuth, sign-in components, and the TanStack Query hook-per-resource convention. Use when setting up data fetching or sign-in in a React app, adding a query or mutation hook, or handling API errors and field validation messages in forms.
license: MIT
metadata:
  version: "0.2.0"
  packages: "@softwareseva/core@0.2 @softwareseva/auth@0.2"
---

# React API client and auth

## Setup

1. `pnpm add @softwareseva/core @softwareseva/auth @softwareseva/ui @tanstack/react-query @simplewebauthn/browser`.
2. Copy `templates/api.ts` to `src/lib/api.ts`. It creates one client: cookie credentials, refresh through `POST /auth/refresh`, and redirect to `/sign-in` when refresh fails.
3. Wrap the app (`templates/main.tsx`): `QueryClientProvider client={createQueryClient()}` (from `@softwareseva/core/react`) then `AuthProvider api={api}`. `AuthProvider`/`useAuth` are TanStack Query-backed, so the provider must be inside `QueryClientProvider`.
4. Guard routes with `useAuth().status` (`"loading" | "signed-in" | "signed-out"`), see `templates/require-auth.tsx`.

In development, proxy `/v1` to the Worker (`vite.config.ts` `server.proxy`), so cookies are same-origin and CORS is not involved.

## Calling the API

```ts
const note = await api.get<Note>(`/notes/${id}`);
await api.post<Note>("/notes", { title });
```

Every method returns the unwrapped `data` or throws `ApiError { code, message, status, fields?, requestId? }`. Show `error.fields?.title?.[0]` next to the field and `error.message` otherwise. Never parse error text; branch on `code`.

## One hook per resource

Keep query keys and fetchers together (`templates/use-notes.ts`), built on `useApiQuery`/`useApiMutation` from `@softwareseva/core/react` — thin wrappers over TanStack Query's `useQuery`/`useMutation` that type errors as `ApiError` instead of `unknown`:

```ts
export const noteKeys = { all: ["notes"] as const, list: (q: ListParams) => [...noteKeys.all, "list", q] as const, one: (id: string) => [...noteKeys.all, id] as const };
export const useNotes = (q: ListParams) => useApiQuery({ queryKey: noteKeys.list(q), queryFn: () => api.get<Page<Note>>(`/notes?${toSearch(q)}`), placeholderData: keepPreviousData });
export const useCreateNote = () => { const qc = useQueryClient(); return useApiMutation({ mutationFn: (b: NewNote) => api.post<Note>("/notes", b), onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }) }); };
```

Pages import hooks, never `api` directly. For a paginated list, use `createListQuery` from `@softwareseva/list/react` instead of hand-writing this — see the `react-data-table` skill.

## Sign-in UI

`<SignIn next="/app" onSuccess={() => navigate("/app")} />` renders every provider the server reports via `/auth/config`: passkey button, Google, Apple, OTP (with password as an alternative when both are on). Compose `PasskeyButton`, `OAuthButton`, `OtpSignIn`, `PasswordSignIn` for custom layouts, or use the hooks (`useOtp`, `usePasskeySignIn`, `usePasswordSignIn`, `usePasskeyRegister`) with your own markup. Error codes map to messages with `authMessage(code)`.

## Tailwind

`@softwareseva/auth/react` components use `@softwareseva/ui` classes. Add both packages to Tailwind's sources:

```css
@source "../node_modules/@softwareseva/ui/dist";
@source "../node_modules/@softwareseva/auth/dist/react";
```

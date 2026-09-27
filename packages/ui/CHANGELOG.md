# @softwareseva/ui

## 1.0.0

### Major Changes

- 77873b4: Rework the React-facing surface onto TanStack libraries.

  - `@softwareseva/core` gains a `./react` subpath (`useApiQuery`, `useApiMutation`, `createQueryClient`) — a thin TanStack Query binding that types errors as `ApiError`.
  - `@softwareseva/list`'s `DataTable` now renders through TanStack Table internally (same `columns`/`sort`/`direction`/`onSort` props); adds `createListQuery` to build a directory's URL state + keyset fetch as one hook.
  - `@softwareseva/auth`'s `AuthProvider`/`useAuth` and sign-in hooks (`usePasswordSignIn`, `useOtp`, `usePasskeySignIn`, `usePasskeyRegister`) are now backed by TanStack Query instead of local component state; `AuthProvider` must be mounted inside a `QueryClientProvider`. `PasswordSignIn`/`OtpSignIn` now use `@softwareseva/ui`'s `useAppForm`.
  - `@softwareseva/ui` adds TanStack Form field bindings (`useAppForm`, `TextField`, `CheckboxField`, `SelectField`, `RadioGroupField`) alongside the existing uncontrolled `Field`.

  Breaking: `DataTable`'s `sort` prop is now typed as the column key type instead of `string`; `AuthProvider` requires a `QueryClientProvider` ancestor; `@softwareseva/ui` now requires `@tanstack/react-form` as a peer dependency.

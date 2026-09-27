# @softwareseva/auth

## 1.1.0

### Minor Changes

- 0e82b44: Passkeys become the default, anonymous entry point.
  
  - **Contact-free sign-up**: `POST /passkeys/signup/options` / `verify` create a brand-new account with no email, phone or OAuth grant — the passkey is verified first, and the account (plus its passkey) is written only after that succeeds, in one atomic write. `AuthStore.createUserWithPasskey` never leaves an orphaned user or an unattached credential. Disable with `providers.passkeys.allowSignUp = false`.
  - **Facebook Login**: a new provider (`providers.facebook`) mirroring Google/Apple — web authorization-code flow and native access-token verification via the Graph API.
  - **`requireVerified`**: a new middleware (alongside `requireRole`) for gating specific actions behind a "valid id" — an OTP-verified email/phone, or a linked Google/Apple/Facebook identity — without requiring one for sign-in itself. `isVerifiedIdentity(user)` is the underlying check.
  - Passkeys now record the `rpId` (domain) they were created for; `GET /passkeys` returns it so a "manage passkeys" screen can show which domain each key is tied to.
  - React: `<PasskeySignUpButton />` and `usePasskeySignUp()`; `<SignIn />` now shows passkeys first (sign-in, then contact-free sign-up) with OTP/OAuth offered as the way to attach a valid id, not as the primary way in. `<OAuthButton />` and `useOAuthUrl` accept `"facebook"`.
  
  Migration `auth_0003_passkey_domain.sql` adds `auth_passkeys.rp_id` (nullable, backward compatible).

### Patch Changes

- @softwareseva/core@1.1.0
  - @softwareseva/ui@1.1.0

## 1.0.0

### Major Changes

- 77873b4: Rework the React-facing surface onto TanStack libraries.

  - `@softwareseva/core` gains a `./react` subpath (`useApiQuery`, `useApiMutation`, `createQueryClient`) — a thin TanStack Query binding that types errors as `ApiError`.
  - `@softwareseva/list`'s `DataTable` now renders through TanStack Table internally (same `columns`/`sort`/`direction`/`onSort` props); adds `createListQuery` to build a directory's URL state + keyset fetch as one hook.
  - `@softwareseva/auth`'s `AuthProvider`/`useAuth` and sign-in hooks (`usePasswordSignIn`, `useOtp`, `usePasskeySignIn`, `usePasskeyRegister`) are now backed by TanStack Query instead of local component state; `AuthProvider` must be mounted inside a `QueryClientProvider`. `PasswordSignIn`/`OtpSignIn` now use `@softwareseva/ui`'s `useAppForm`.
  - `@softwareseva/ui` adds TanStack Form field bindings (`useAppForm`, `TextField`, `CheckboxField`, `SelectField`, `RadioGroupField`) alongside the existing uncontrolled `Field`.

  Breaking: `DataTable`'s `sort` prop is now typed as the column key type instead of `string`; `AuthProvider` requires a `QueryClientProvider` ancestor; `@softwareseva/ui` now requires `@tanstack/react-form` as a peer dependency.

### Patch Changes

- Updated dependencies [77873b4]
  - @softwareseva/core@1.0.0
  - @softwareseva/ui@1.0.0

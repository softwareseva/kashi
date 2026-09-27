---
"@softwareseva/auth": minor
---

Passkeys become the default, anonymous entry point.

- **Contact-free sign-up**: `POST /passkeys/signup/options` / `verify` create a brand-new account with no email, phone or OAuth grant — the passkey is verified first, and the account (plus its passkey) is written only after that succeeds, in one atomic write. `AuthStore.createUserWithPasskey` never leaves an orphaned user or an unattached credential. Disable with `providers.passkeys.allowSignUp = false`.
- **Facebook Login**: a new provider (`providers.facebook`) mirroring Google/Apple — web authorization-code flow and native access-token verification via the Graph API.
- **`requireVerified`**: a new middleware (alongside `requireRole`) for gating specific actions behind a "valid id" — an OTP-verified email/phone, or a linked Google/Apple/Facebook identity — without requiring one for sign-in itself. `isVerifiedIdentity(user)` is the underlying check.
- Passkeys now record the `rpId` (domain) they were created for; `GET /passkeys` returns it so a "manage passkeys" screen can show which domain each key is tied to.
- React: `<PasskeySignUpButton />` and `usePasskeySignUp()`; `<SignIn />` now shows passkeys first (sign-in, then contact-free sign-up) with OTP/OAuth offered as the way to attach a valid id, not as the primary way in. `<OAuthButton />` and `useOAuthUrl` accept `"facebook"`.

Migration `auth_0003_passkey_domain.sql` adds `auth_passkeys.rp_id` (nullable, backward compatible).

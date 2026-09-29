## 1.6.0

- No functional changes; version bump to stay in lockstep with the npm packages.

## 1.5.0

- No functional changes; version bump to stay in lockstep with the npm packages. `@softwareseva/auth` 1.5.0's opt-in identity extensions (multi-channel OTP, account linking, recovery codes, session revocation, federation hooks) are all server-side config and new HTTP routes — none of it touches this client.

## 1.4.0

- No functional changes; version bump to stay in lockstep with the npm packages (jumping straight from 1.2.0 to 1.4.0 — the intervening `@softwareseva/auth` 1.3.0 peer-federation fixes and 1.4.0 `renderOtpEmail()` addition are both server-only and don't touch this client).

## 1.2.0

- Cross-site sign-in: `AuthProviders.peers`, `KashiAuthApi.peerAuthorizeUrl`/`peerToken`, the `PeerBrowserSignIn` adapter seam, and `KSignIn(peerBrowser: ...)` render a "Continue with {label}" button per kashi site the server trusts. The app supplies the system-browser bridge (e.g. `flutter_web_auth_2`); the client secret never leaves the backend.

## 1.1.0

- Passkeys are now the default, anonymous entry point: `passkeySignUpOptions`/`passkeySignUpVerify` create a contact-free account straight from a new passkey (no email, phone or OAuth), and `KSignIn` offers it alongside passkey sign-in when the server reports `passkeySignUp`.
- `PasskeyItem.rpId` records which domain a passkey was created for.
- Facebook Login: `KashiAuthApi.facebook`, the `AccessTokenSignIn`/`AccessTokenResult` adapter seam, and `KSignIn(facebook: ...)`.
- `AuthProviders` gains `facebook` and `passkeySignUp`.

## 1.0.0

- No functional changes; version aligned with the fixed npm release group and the other kashi_* packages.

## 0.1.2

- Adds `example/example.md`.

## 0.1.1

- No functional changes; shortens the pubspec description to fit pub.dev's 180-character limit.

## 0.1.0

- Initial release: KashiAuthApi, KSignIn, adapters for ID-token providers and passkeys, KBiometricGate.

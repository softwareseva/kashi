# Sign in with Apple: setup notes

## Order of operations

1. Certificates, Identifiers & Profiles > Identifiers > App IDs > your iOS app > Capabilities > Sign in with Apple (Enable as a primary App ID).
2. Identifiers > + > Services IDs > description and identifier (`com.example.web`) > Continue > Register.
3. Open the Services ID > Sign in with Apple > Configure: Primary App ID = step 1; Domains = `api.example.com` and `app.example.com`; Return URLs = `https://api.example.com/v1/auth/apple/callback`. Save, Continue, Save.
4. Keys > + > name > Sign in with Apple > Configure > Primary App ID > Save > Continue > Register > Download. Note the Key ID.
5. Membership details > Team ID.

## Environment

| Name | Kind | Example |
|---|---|---|
| `APPLE_CLIENT_ID` | var | `com.example.web` |
| `APPLE_TEAM_ID` | var | `ABCDE12345` |
| `APPLE_KEY_ID` | var | `XYZ987WVUT` |
| `APPLE_PRIVATE_KEY` | secret | contents of `AuthKey_XYZ987WVUT.p8` |
| `APPLE_BUNDLE_IDS` | var | `com.example.app` (comma-separated) |
| `AUTH_URL` | var | `https://api.example.com/v1/auth` |

## Client secret

Apple's client secret is a JWT (`ES256`, header `kid` = key id; claims `iss` = team id, `sub` = Services ID, `aud` = `https://appleid.apple.com`, `exp` at most 6 months). `@kashi/auth` mints a 10-minute one per exchange with WebCrypto, so there is nothing to rotate on a calendar. The `.p8` key itself does not expire; revoke and replace it if it leaks.

## Verification

ID tokens are RS256, verified against Apple's JWKS (cached 6 hours, refetched on an unknown `kid`), with `iss = https://appleid.apple.com` and `aud` in `[APPLE_CLIENT_ID, ...APPLE_BUNDLE_IDS]`.

## Account deletion

App Store rules require in-app account deletion. When a user deletes their account, also revoke their Apple token via `https://appleid.apple.com/auth/revoke` (needs the refresh token from the code exchange; store it if you implement deletion) or at least delete the `auth_identities` row.

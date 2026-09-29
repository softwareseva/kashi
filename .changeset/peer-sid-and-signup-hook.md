---
"@softwareseva/auth": minor
---

`hooks.onFederationSession` now receives the issuer's verified `sid` claim as `claims.sessionId` (when the issuer adds it via `federationClaims`), so consumer sites can enforce central session revocation.

The native `POST /peer/token` route now also calls `onFederationSession` (same order as the browser callback: `beforeSession`, hook, `onSignIn`, session), issues the session under the same family id it hands the hook, fails closed if the hook throws, and is rate limited (`peer-token`, 20 per 10 minutes per IP).

`usePasskeySignUp` is now exported from `@softwareseva/auth/react`.

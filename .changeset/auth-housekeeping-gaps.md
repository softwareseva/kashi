---
"@softwareseva/auth": patch
---

`AuthStore.prune()` now also deletes expired `auth_federation_codes`, and expired `auth_bound_otp` rows when the opt-in `auth_0007` migration is applied.

Multi-channel OTP sign-in (`otpChannels`, `POST /otp/verify`) accepts `transport` and `deviceName` like the legacy route, so native apps can get a token pair instead of cookies.

Peer (federation) sign-in refetches the issuer's JWKS once when an ID token's `kid` isn't in the cached set, so issuer key rotation no longer fails sign-ins for up to an hour.

`requireRecent` matches the `Authorization: Bearer` scheme case-insensitively, the same as `requireAuth`.

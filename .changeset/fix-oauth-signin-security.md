---
"@softwareseva/auth": patch
---

Fix two sign-in security issues: OAuth/peer sign-in `state` is now bound to a single-use, browser-scoped cookie (like the existing Google account-linking flow) instead of a bare signed JWT, closing a login-CSRF window where an attacker could hand a victim a callback URL carrying the attacker's own code and get them signed into the attacker's account; Apple's `form_post` callback cookie is now `SameSite=None; Secure` so it survives the cross-site POST. Automatic account linking by email now only trusts the `emailVerified` claim from Google and Apple — Facebook (which only reports whether an email exists, not that it verified it) and peer kashi sites now get `ACCOUNT_MERGE_REQUIRED` on a matching email instead of being silently linked to an existing local account.

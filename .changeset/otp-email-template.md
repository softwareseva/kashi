---
"@softwareseva/auth": minor
---

Add `renderOtpEmail({ code, purpose, ttlSeconds, brand })` from `@softwareseva/auth/server`: a ready-made, responsive, table-based HTML + plain-text template for one-time-code emails, with distinct wording for `"sign-in"` and `"link"` purposes, escaped dynamic content, no remote images, and optional brand name/colors. `renderOtpEmail` only formats the message — it never sends anything.

The `otp` provider's `send` callback now receives a fifth argument, `{ purpose, ttlSeconds }` (using the configured `ttlSeconds`, default 300), so senders can pass it straight into `renderOtpEmail`. Existing four-argument `send` implementations remain valid and keep working unchanged.

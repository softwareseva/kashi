# kashi example API

A Hono Worker on D1 built from `@softwareseva/core` and `@softwareseva/list`: the envelope, request ids, rate limiting, and a keyset-paginated `notes` resource. The integration tests run the real Worker against a disposable D1 through the Cloudflare Vitest plugin.

```bash
pnpm test              # integration tests with real D1
pnpm dev               # wrangler dev (run db:migrate:local once)
```

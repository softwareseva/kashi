# Testing a Worker

Two layers:

1. **Unit** (plain vitest): pure helpers, services with a fake repository. Fast, no bindings.
2. **Integration** (`@cloudflare/vitest-plugin`): the real Worker with real D1 semantics. Each test file gets an isolated D1 with all migrations applied by `test/integration/setup.ts`.

```ts
import { SELF, env } from "cloudflare:test";
const res = await SELF.fetch("http://example.com/v1/notes");
await env.DB.prepare("INSERT ...").run();   // seed directly when needed
```

- `wrangler.test.jsonc` holds test-only vars and placeholder secrets. Never point it at a real database id.
- Assert on the envelope: status, `code`, `fields`, `requestId` presence.
- Cover: validation failure, not found, forward and backward paging, search with `%` in the input, rate limit trip.
- `fileParallelism: false` keeps D1 isolation predictable.
- `test/cloudflare-test.d.ts` declares the bindings so `env.DB` is typed.

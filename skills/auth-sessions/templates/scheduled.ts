/** Daily cleanup. In wrangler.jsonc: "triggers": { "crons": ["17 3 * * *"] } */
import { AuthStore } from "@softwareseva/auth/server";
import { pruneRateLimits } from "@softwareseva/core/server";
import app from "./index";
import type { Bindings } from "./types";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings) {
    await new AuthStore(env.DB).prune();
    await pruneRateLimits(env.DB);
  },
} satisfies ExportedHandler<Bindings>;

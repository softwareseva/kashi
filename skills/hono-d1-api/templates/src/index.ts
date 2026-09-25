/** Composition root: builds the app from @kashi/core and mounts the feature routers. */
import { createApp } from "@kashi/core/server";
import { exampleRoutes } from "./routes/example";
import type { AppEnv } from "./types";

const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.route("/v1/examples", exampleRoutes);

export default app;

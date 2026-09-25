/** Composition root: builds the app from @kashi/core and mounts the resource routers. */
import { createApp } from "@kashi/core/server";
import { notesRoutes } from "./routes/notes";
import type { AppEnv } from "./types";

const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.route("/v1/notes", notesRoutes);

export default app;

/** Composition root: builds the app from @softwareseva/core and mounts auth and the resource routers. */
import { authRouter } from "@softwareseva/auth/server";
import { createApp } from "@softwareseva/core/server";
import { authConfig } from "./auth";
import { notesRoutes } from "./routes/notes";
import { meRoutes } from "./routes/me";
import { syncRoutes } from "./sync";
import type { AppEnv } from "./types";

const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.route("/v1/auth", authRouter(authConfig));
app.route("/v1/notes", notesRoutes);
app.route("/v1/account", meRoutes);
app.route("/v1/sync", syncRoutes);

export default app;

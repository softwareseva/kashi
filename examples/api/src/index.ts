/** Composition root: builds the app from @kashi/core and mounts auth and the resource routers. */
import { authRouter } from "@kashi/auth/server";
import { createApp } from "@kashi/core/server";
import { authConfig } from "./auth";
import { notesRoutes } from "./routes/notes";
import { meRoutes } from "./routes/me";
import type { AppEnv } from "./types";

const app = createApp<AppEnv>({ origins: (env) => [env.WEB_ORIGIN] });
app.route("/v1/auth", authRouter(authConfig));
app.route("/v1/notes", notesRoutes);
app.route("/v1/account", meRoutes);

export default app;

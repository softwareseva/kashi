/** `kashi add <feature>`: install the package, copy migrations, print secrets and the mount snippet. */
import { execSync } from "node:child_process";
import { log, packageManager } from "../util.js";
import { migrate } from "./migrate.js";
import { secrets } from "./secrets.js";

const FEATURES: Record<string, { pkg: string; mount?: string }> = {
  core: { pkg: "@kashi/core" },
  list: { pkg: "@kashi/list" },
  auth: { pkg: "@kashi/auth", mount: 'app.route("/v1/auth", authRouter({ /* see the auth-sessions skill */ }));' },
  sync: { pkg: "@kashi/sync", mount: 'app.route("/v1/sync", syncRouter({ handlers }));' },
  ui: { pkg: "@kashi/ui" },
};

export function add(cwd: string, feature: string, options: { install?: boolean }) {
  const spec = FEATURES[feature];
  if (!spec) { log.warn(`unknown feature "${feature}". Known: ${Object.keys(FEATURES).join(", ")}`); return 1; }
  log.title(`kashi add ${feature}`);
  if (options.install !== false) {
    const pm = packageManager(cwd);
    const cmd = `${pm} add ${spec.pkg}`;
    log.info(`running: ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit" });
  }
  migrate(cwd, {});
  secrets(cwd, {});
  if (spec.mount) { log.title("mount in your composition root:"); console.log(`  ${spec.mount}`); }
  log.info(`then load the matching skill (e.g. \`${feature === "auth" ? "auth-sessions" : feature}\`) for wiring details`);
  return 0;
}

/** `kashi update`: bump every @kashi package, copy new migrations, report app-side template drift. */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { installedPackages, log, packageManager } from "../util.js";
import { migrate } from "./migrate.js";
import { updateModules } from "./modules.js";

export function update(cwd: string, options: { install?: boolean }, cliVersion = "0.0.0") {
  log.title("kashi update");
  const pm = packageManager(cwd);
  if (options.install !== false) {
    const cmd = pm === "pnpm" ? 'pnpm up "@kashi/*" --latest' : pm === "yarn" ? 'yarn up "@kashi/*"' : pm === "bun" ? 'bun update "@kashi/*"' : 'npm update "@kashi/*"';
    log.info(`running: ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit" });
  }
  for (const pkg of installedPackages(cwd)) log.ok(`${pkg.name}@${pkg.version}`);
  migrate(cwd, {});
  updateModules(cwd, cliVersion);
  reportDrift(cwd, cliVersion);
}

/** Files copied by `kashi add` carry `kashi:<package>@<version>`; flag those behind the installed version. */
function reportDrift(cwd: string, cliVersion: string) {
  const versions = new Map(installedPackages(cwd).map((p) => [p.name, p.version]));
  versions.set("@kashi/cli", cliVersion);
  const stale: string[] = [];
  walk(cwd, (file) => {
    let head = "";
    try { head = readFileSync(file, "utf8").slice(0, 400); } catch { return; }
    const m = head.match(/kashi:(@kashi\/[a-z-]+)@(\d+\.\d+\.\d+)/);
    if (m && versions.get(m[1]!) && versions.get(m[1]!) !== m[2]) stale.push(`${relative(cwd, file)} (from ${m[1]}@${m[2]}, installed ${versions.get(m[1]!)})`);
  });
  if (stale.length) { log.title("template files written by an older package version (review the package CHANGELOG, re-run `kashi add --force` to overwrite):"); stale.forEach((s) => log.warn(s)); }
  else log.ok("no template drift");
}

function walk(dir: string, visit: (file: string) => void, depth = 0) {
  if (depth > 6) return;
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", ".dart_tool", ".wrangler"].includes(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    st.isDirectory() ? walk(path, visit, depth + 1) : visit(path);
  }
}

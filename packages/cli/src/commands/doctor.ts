/** `kashi doctor`: gitignore coverage, tracked secret files, missing local secrets, pending migrations. */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installedPackages, log, migrationsDir, readJson } from "../util.js";
import { collectSecrets } from "./secrets.js";

const SECRET_GLOBS = [".dev.vars", ".env", ".env.local", ".env.production", "*.p8", "*.p12", "*.keystore", "*.jks", "*.mobileprovision"];

export function doctor(cwd: string): number {
  log.title("kashi doctor");
  let problems = 0;
  const fail = (msg: string) => { log.warn(msg); problems += 1; };

  // 1. gitignore (ask git so parent and global ignore files count; fall back to reading .gitignore)
  const sample = (g: string) => (g.startsWith("*") ? `kashi-doctor-sample${g.slice(1)}` : g);
  let uncovered: string[];
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "ignore" });
    uncovered = SECRET_GLOBS.filter((g) => { try { execSync(`git check-ignore -q "${sample(g)}"`, { cwd, stdio: "ignore" }); return false; } catch { return true; } });
  } catch {
    const lines = existsSync(join(cwd, ".gitignore")) ? readFileSync(join(cwd, ".gitignore"), "utf8").split(/\r?\n/).map((l) => l.trim()) : [];
    uncovered = SECRET_GLOBS.filter((g) => !lines.includes(g) && !lines.includes(`/${g}`) && !(g.startsWith(".env.") && lines.includes(".env.*")));
  }
  uncovered.length ? fail(`.gitignore does not cover: ${uncovered.join(", ")} (run: kashi secrets)`) : log.ok(".gitignore covers secret files");

  // 2. tracked secret files
  try {
    const tracked = execSync("git ls-files", { cwd, encoding: "utf8" }).split("\n").filter(Boolean);
    const leaked = tracked.filter((f) => SECRET_GLOBS.some((g) => (g.startsWith("*") ? f.endsWith(g.slice(1)) : f === g || f.endsWith(`/${g}`))));
    leaked.length ? fail(`secret files are tracked by git: ${leaked.join(", ")} (git rm --cached them and rotate the secrets)`) : log.ok("no secret files tracked by git");
  } catch { log.info("not a git repository; skipped tracked-file check"); }

  // 3. required secrets present locally
  const declared = collectSecrets(cwd);
  const required = declared.filter(({ entry }) => !entry.optional && !entry.when);
  const conditional = declared.filter(({ entry }) => !entry.optional && entry.when);
  if (conditional.length) log.info(`conditional secrets (needed only when the feature is on): ${conditional.map((s) => `${s.entry.name} [${s.entry.when}]`).join(", ")}`);
  if (required.length) {
    const devVars = existsSync(join(cwd, ".dev.vars")) ? readFileSync(join(cwd, ".dev.vars"), "utf8") : "";
    const missing = required.filter(({ entry }) => entry.store.includes("dev-vars") && !new RegExp(`^${entry.name}=.+`, "m").test(devVars));
    missing.length ? fail(`.dev.vars is missing values for: ${missing.map((m) => m.entry.name).join(", ")}`) : log.ok("all required local secrets are set in .dev.vars");
    const remote = wranglerSecretNames(cwd);
    if (remote) {
      const missingRemote = required.filter(({ entry }) => entry.store.includes("wrangler-secret") && !remote.has(entry.name));
      missingRemote.length ? fail(`deployed Worker is missing secrets: ${missingRemote.map((m) => m.entry.name).join(", ")} (wrangler secret put NAME)`) : log.ok("deployed Worker has every required secret");
    }
  } else log.info("no required secrets declared by installed packages");

  // 4. pending migrations
  const lock = readJson<{ migrations: Record<string, string> }>(join(cwd, "kashi.lock.json")) ?? { migrations: {} };
  const dir = migrationsDir(cwd);
  const present = existsSync(dir) ? readdirSync(dir) : [];
  const pending = installedPackages(cwd).flatMap((p) => p.migrations.filter((m) => !lock.migrations[`${p.name}/${m}`] && !present.some((f) => f.endsWith(`_${m}`))).map((m) => `${p.name}/${m}`));
  pending.length ? fail(`package migrations not yet copied: ${pending.join(", ")} (run: kashi migrate)`) : log.ok("all package migrations are copied");

  console.log(problems ? `\n${problems} problem(s) found` : "\nall good");
  return problems ? 1 : 0;
}

function wranglerSecretNames(cwd: string): Set<string> | null {
  if (!["wrangler.jsonc", "wrangler.json", "wrangler.toml"].some((f) => existsSync(join(cwd, f)))) return null;
  try {
    const out = execSync("wrangler secret list --format json 2>/dev/null", { cwd, encoding: "utf8", timeout: 20_000 });
    return new Set((JSON.parse(out) as { name: string }[]).map((s) => s.name));
  } catch { log.info("could not read deployed secrets (wrangler not logged in?); skipped"); return null; }
}

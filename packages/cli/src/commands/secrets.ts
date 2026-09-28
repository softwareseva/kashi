/** `kashi secrets`: checklist of every secret installed packages need, plus .dev.vars.example and .gitignore upkeep. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ensureLines, installedPackages, log, readJson, type SecretEntry } from "../util.js";
import { moduleDir, moduleSecrets, type Lock } from "../modules.js";

export function collectSecrets(cwd: string): { pkg: string; dir: string; entry: SecretEntry }[] {
  const fromPackages = installedPackages(cwd).flatMap((pkg) => (pkg.secrets?.secrets ?? []).map((entry) => ({ pkg: pkg.name, dir: pkg.dir, entry })));
  const modules = Object.keys(readJson<Lock>(join(cwd, "kashi.lock.json"))?.modules ?? {});
  const fromModules = modules.flatMap((m) => (moduleSecrets(m)?.secrets ?? []).map((entry) => ({ pkg: m, dir: moduleDir(m), entry })));
  return [...fromPackages, ...fromModules];
}

export function secrets(cwd: string, options: { write?: boolean; only?: string }) {
  log.title("kashi secrets");
  const all = collectSecrets(cwd).filter(({ pkg }) => !options.only || pkg === options.only);
  if (!all.length) { log.info("no installed @softwareseva package declares secrets"); return; }
  for (const { pkg, dir, entry } of all) {
    console.log(`\n  ${entry.name}${entry.optional ? " (optional)" : ""}  [${pkg}${entry.usedBy ? ` ${entry.usedBy}` : ""}]`);
    console.log(`    ${entry.description}`);
    console.log(`    generate: ${entry.generate}`);
    console.log(`    store:    ${entry.store.map(storeHint).join("; ")}`);
    if (entry.rotate) console.log(`    rotate:   ${entry.rotate}`);
    if (entry.when) console.log(`    when:     ${entry.when}`);
    if (entry.docs) console.log(`    docs:     ${join(dir, entry.docs)}`);
  }
  if (options.write !== false) {
    const names = [...new Set(all.filter(({ entry }) => entry.store.includes("dev-vars")).map(({ entry }) => entry.name))];
    const examplePath = join(cwd, ".dev.vars.example");
    const existing = existsSync(examplePath) ? readFileSync(examplePath, "utf8") : "";
    const missing = names.filter((n) => !new RegExp(`^${n}=`, "m").test(existing));
    if (missing.length && names.length) {
      writeFileSync(examplePath, `${existing.trimEnd()}${existing ? "\n" : ""}${missing.map((n) => `${n}=`).join("\n")}\n`);
      log.ok(`added ${missing.length} placeholder(s) to .dev.vars.example`);
    }
    const ignore = [".dev.vars", ".env", ...all.flatMap(({ entry }) => entry.gitignore ?? [])];
    const added = ensureLines(join(cwd, ".gitignore"), [...new Set(ignore)], "# kashi: secrets");
    if (added.length) log.ok(`added ${added.length} .gitignore line(s)`);
  }
}

function storeHint(store: string): string {
  switch (store) {
    case "wrangler-secret": return "production: wrangler secret put NAME";
    case "dev-vars": return "local: NAME=value in .dev.vars";
    case "ci-secret": return "CI: repository secret (gh secret set NAME)";
    case "env": return "environment variable";
    case "match": return "fastlane match (encrypted certificates repo)";
    case "keychain": return "developer keychain, never in the repo";
    default: return store;
  }
}

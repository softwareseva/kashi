/** `kashi add <module>` for template modules and the module half of `kashi update`. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensureLines, log, readJson } from "../util.js";
import { loadModule, moduleSecrets, renderModule, renderNext, resolveVars, sha, type Lock } from "../modules.js";

const lockPath = (cwd: string) => join(cwd, "kashi.lock.json");
const readLock = (cwd: string): Lock => readJson<Lock>(lockPath(cwd)) ?? { migrations: {} };
const writeLock = (cwd: string, lock: Lock) => writeFileSync(lockPath(cwd), JSON.stringify(lock, null, 2) + "\n");

export function addModule(cwd: string, name: string, version: string, options: { force?: boolean; vars?: Record<string, string> }): number {
  const spec = loadModule(name);
  if (!spec) return -1;
  log.title(`kashi add ${name}`);
  log.info(spec.description);
  const lock = readLock(cwd);
  const vars = resolveVars(spec, cwd, options.vars ?? {}, lock.modules?.[name]?.vars);
  for (const [k, v] of Object.entries(vars)) log.info(`${k} = ${v || "(empty)"}${spec.vars[k]?.help ? `  — ${spec.vars[k]!.help}` : ""}`);
  const files: Record<string, string> = {};
  for (const file of renderModule(spec, vars)) {
    const path = join(cwd, file.dest);
    if (existsSync(path) && (file.ifMissing || !options.force) && readFileSync(path, "utf8") !== file.content) {
      log.warn(`${file.dest} exists; left unchanged${file.ifMissing ? "" : " (use --force to overwrite)"}`);
      files[file.dest] = lock.modules?.[name]?.files[file.dest] ?? sha(readFileSync(path, "utf8"));
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    files[file.dest] = sha(file.content);
    log.ok(`wrote ${file.dest}`);
  }
  const manifest = moduleSecrets(name);
  const ignore = (manifest?.secrets ?? []).flatMap((s) => s.gitignore ?? []);
  if (ignore.length) {
    const added = ensureLines(join(cwd, ".gitignore"), [...new Set(ignore)], `# kashi: ${name} secrets`);
    if (added.length) log.ok(`added ${added.length} .gitignore line(s)`);
  }
  lock.modules = { ...(lock.modules ?? {}), [name]: { version, vars, files } };
  writeLock(cwd, lock);
  const next = renderNext(spec, vars);
  if (next.length) { log.title("next steps:"); next.forEach((n, i) => console.log(`  ${i + 1}. ${n}`)); }
  log.info("secrets for this module: npx @softwareseva/cli secrets");
  return 0;
}

/**
 * Re-render every installed module with the current templates. Files you have not edited are
 * updated in place; edited files get the new version next to them as `<file>.kashi-new`.
 */
export function updateModules(cwd: string, version: string): { updated: string[]; conflicts: string[] } {
  const lock = readLock(cwd);
  const updated: string[] = []; const conflicts: string[] = [];
  for (const [name, installed] of Object.entries(lock.modules ?? {})) {
    const spec = loadModule(name);
    if (!spec) { log.warn(`module ${name} is no longer shipped by @softwareseva/cli; left as is`); continue; }
    const vars = resolveVars(spec, cwd, {}, installed.vars);
    for (const file of renderModule(spec, vars)) {
      const path = join(cwd, file.dest);
      const nextHash = sha(file.content);
      const baseHash = installed.files[file.dest];
      if (!existsSync(path)) {
        if (file.ifMissing && baseHash) continue;
        mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, file.content); installed.files[file.dest] = nextHash; updated.push(file.dest); continue;
      }
      const current = readFileSync(path, "utf8");
      if (sha(current) === nextHash) { installed.files[file.dest] = nextHash; continue; }
      if (file.ifMissing) continue;
      if (sha(current) === baseHash) {
        writeFileSync(path, file.content); installed.files[file.dest] = nextHash; updated.push(file.dest);
      } else if (baseHash !== nextHash) {
        writeFileSync(`${path}.kashi-new`, file.content); conflicts.push(file.dest);
      }
    }
    installed.version = version;
  }
  writeLock(cwd, lock);
  updated.forEach((f) => log.ok(`updated ${f}`));
  conflicts.forEach((f) => log.warn(`${f} has local edits; the new template is in ${f}.kashi-new — merge it, then delete the .kashi-new file`));
  if (!updated.length && !conflicts.length && Object.keys(lock.modules ?? {}).length) log.ok("module templates are current");
  return { updated, conflicts };
}

export const installedModules = (cwd: string) => Object.keys(readLock(cwd).modules ?? {});

/** `kashi migrate`: copy package-shipped SQL migrations into the project's migrations directory. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { installedPackages, log, migrationsDir, readJson } from "../util.js";

type Lock = { migrations: Record<string, string> };

export function migrate(cwd: string, options: { dryRun?: boolean; dir?: string }) {
  log.title("kashi migrate");
  const target = options.dir ? join(cwd, options.dir) : migrationsDir(cwd);
  mkdirSync(target, { recursive: true });
  const lockPath = join(cwd, "kashi.lock.json");
  const lock = readJson<Lock>(lockPath) ?? { migrations: {} };
  const existing = readdirSync(target).filter((f) => f.endsWith(".sql")).sort();
  let next = existing.reduce((max, f) => Math.max(max, Number(f.match(/^(\d+)_/)?.[1] ?? 0)), 0) + 1;
  let copied = 0;
  for (const pkg of installedPackages(cwd)) {
    for (const file of pkg.migrations) {
      const key = `${pkg.name}/${file}`;
      if (lock.migrations[key] || existing.some((f) => f.endsWith(`_${file}`))) continue;
      const name = `${String(next).padStart(4, "0")}_${file}`;
      if (!options.dryRun) copyFileSync(join(pkg.dir, "migrations", file), join(target, name));
      lock.migrations[key] = name;
      log.ok(`${options.dryRun ? "would copy" : "copied"} ${key} -> ${relative(cwd, join(target, name))}`);
      next += 1; copied += 1;
    }
  }
  if (!options.dryRun && copied) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  if (!copied) log.info("no new package migrations");
  else log.info(`apply with: wrangler d1 migrations apply <DB_NAME> --local (then --remote when ready)`);
  return copied;
}

export const hasMigrations = (cwd: string) => existsSync(migrationsDir(cwd));

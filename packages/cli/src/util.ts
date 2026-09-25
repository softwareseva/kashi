/** Filesystem and package-manager helpers shared by the commands. */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

export type SecretEntry = { name: string; usedBy?: string; description: string; generate: string; store: string[]; rotate?: string; optional?: boolean; when?: string; gitignore?: string[] };
export type SecretsManifest = { package: string; secrets: SecretEntry[] };
export type InstalledPackage = { name: string; version: string; dir: string; migrations: string[]; secrets: SecretsManifest | null };

export function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; } catch { return null; }
}

export function ensureLines(path: string, lines: string[], header?: string): string[] {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const present = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = lines.filter((l) => !present.has(l.trim()));
  if (missing.length) {
    const body = `${existing.endsWith("\n") || existing === "" ? existing : existing + "\n"}${header ? `\n${header}\n` : ""}${missing.join("\n")}\n`;
    writeFileSync(path, body);
  }
  return missing;
}

export function writeIfAbsent(path: string, content: string, force = false): boolean {
  if (existsSync(path) && !force) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

/** Every installed `@kashi/*` package (excluding the CLI) with its shipped migrations and secrets. */
export function installedPackages(cwd: string): InstalledPackage[] {
  const scopeDir = join(cwd, "node_modules", "@kashi");
  if (!existsSync(scopeDir)) return [];
  return readdirSync(scopeDir)
    .filter((name) => name !== "cli" && statSync(join(scopeDir, name)).isDirectory())
    .map((name) => {
      const dir = join(scopeDir, name);
      const pkg = readJson<{ name: string; version: string }>(join(dir, "package.json"));
      const migrationsDir = join(dir, "migrations");
      const migrations = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort() : [];
      return { name: pkg?.name ?? `@kashi/${name}`, version: pkg?.version ?? "0.0.0", dir, migrations, secrets: readJson<SecretsManifest>(join(dir, "secrets.json")) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function packageManager(cwd: string): "pnpm" | "npm" | "yarn" | "bun" {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

/** Migrations directory from wrangler config, default `migrations`. */
export function migrationsDir(cwd: string): string {
  for (const file of ["wrangler.jsonc", "wrangler.json", "wrangler.toml"]) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, "utf8").match(/migrations_dir"?\s*[:=]\s*"([^"]+)"/);
    if (match?.[1]) return join(cwd, match[1]);
  }
  return join(cwd, "migrations");
}

export const log = {
  ok: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  info: (msg: string) => console.log(`  - ${msg}`),
  title: (msg: string) => console.log(`\n${msg}`),
};

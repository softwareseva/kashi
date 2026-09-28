/** Deploy and scaffold modules: templates rendered with project values, tracked by content hash for safe updates. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { readJson, templatesDir, type SecretsManifest } from "./util.js";

export type ModuleVar = { detect?: string; default?: string; help?: string };
export type ModuleFile = { from: string; to: string; when?: string; ifMissing?: boolean };
export type ModuleSpec = { name: string; description: string; vars: Record<string, ModuleVar>; files: ModuleFile[]; next?: string[] };
export type RenderedFile = { dest: string; content: string; ifMissing: boolean };
export type LockModule = { version: string; vars: Record<string, string>; files: Record<string, string> };
export type Lock = { migrations: Record<string, string>; modules?: Record<string, LockModule> };

const modulesDir = join(templatesDir, "modules");

export const listModules = (): string[] => (existsSync(modulesDir) ? readdirSync(modulesDir).filter((n) => existsSync(join(modulesDir, n, "module.json"))) : []);
export const loadModule = (name: string): ModuleSpec | null => readJson<ModuleSpec>(join(modulesDir, name, "module.json"));
export const moduleSecrets = (name: string): SecretsManifest | null => readJson<SecretsManifest>(join(modulesDir, name, "secrets.json"));
export const moduleDir = (name: string): string => join(modulesDir, name);

export const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Values from the project: where wrangler/flutter live, bundle ids, package names. */
const detectors: Record<string, (cwd: string) => string | undefined> = {
  wranglerDir: (cwd) => findUp(cwd, (d) => ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].some((f) => existsSync(join(d, f)))),
  flutterDir: (cwd) => findUp(cwd, (d) => existsSync(join(d, "pubspec.yaml")) && existsSync(join(d, "ios")) && existsSync(join(d, "android"))),
  iosBundleId: (cwd) => {
    const dir = detectors.flutterDir!(cwd);
    const pbx = dir !== undefined ? join(cwd, dir, "ios/Runner.xcodeproj/project.pbxproj") : "";
    if (!pbx || !existsSync(pbx)) return undefined;
    const ids = [...readFileSync(pbx, "utf8").matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([A-Za-z0-9.\-]+)"?;/g)].map((m) => m[1]!).filter((id) => !/Tests$/.test(id));
    return ids[0];
  },
  androidPackage: (cwd) => {
    const dir = detectors.flutterDir!(cwd);
    if (dir === undefined) return undefined;
    for (const f of ["android/app/build.gradle.kts", "android/app/build.gradle"]) {
      const p = join(cwd, dir, f);
      if (existsSync(p)) return readFileSync(p, "utf8").match(/applicationId\s*=?\s*"([^"]+)"/)?.[1];
    }
    return undefined;
  },
};

/** Breadth-first search (depth 3) for a directory matching `test`; returns a path relative to cwd. */
function findUp(cwd: string, test: (dir: string) => boolean): string | undefined {
  const queue: [string, number][] = [[cwd, 0]];
  const skip = new Set(["node_modules", ".git", "build", "dist", ".dart_tool", "ios", "android", ".wrangler"]);
  while (queue.length) {
    const [dir, depth] = queue.shift()!;
    if (test(dir)) return relative(cwd, dir) || ".";
    if (depth >= 3) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!skip.has(name) && !name.startsWith(".") && statSync(p).isDirectory()) queue.push([p, depth + 1]);
    }
  }
  return undefined;
}

export function resolveVars(spec: ModuleSpec, cwd: string, given: Record<string, string>, previous: Record<string, string> = {}): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, v] of Object.entries(spec.vars)) {
    vars[name] = given[name] ?? previous[name] ?? (v.detect ? detectors[v.detect]?.(cwd) : undefined) ?? v.default ?? "";
  }
  return vars;
}

const render = (text: string, vars: Record<string, string>) => text.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (m, name: string) => (name in vars ? vars[name]! : m));
const normalizePath = (p: string) => p.replace(/^\.\//, "").replace(/\/\.\//g, "/").replace(/\/+/g, "/");

export function renderModule(spec: ModuleSpec, vars: Record<string, string>): RenderedFile[] {
  return spec.files
    .filter((f) => !f.when || vars[f.when])
    .map((f) => ({ dest: normalizePath(render(f.to, vars)), content: render(readFileSync(join(modulesDir, spec.name, "files", f.from), "utf8"), vars), ifMissing: Boolean(f.ifMissing) }));
}

export const renderNext = (spec: ModuleSpec, vars: Record<string, string>) => (spec.next ?? []).map((line) => render(line, vars));
export const moduleFileDir = (dest: string) => dirname(dest);

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/commands/migrate.js";
import { doctor } from "../src/commands/doctor.js";

function fakeProject() {
  const cwd = mkdtempSync(join(tmpdir(), "kashi-"));
  const pkg = join(cwd, "node_modules", "@kashi", "core");
  mkdirSync(join(pkg, "migrations"), { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@kashi/core", version: "0.1.0" }));
  writeFileSync(join(pkg, "migrations", "core_0001_rate_limits.sql"), "CREATE TABLE rate_limits(key TEXT PRIMARY KEY);");
  writeFileSync(join(pkg, "secrets.json"), JSON.stringify({ package: "@kashi/core", secrets: [] }));
  mkdirSync(join(cwd, "migrations"));
  writeFileSync(join(cwd, "migrations", "0001_init.sql"), "-- app");
  writeFileSync(join(cwd, "wrangler.jsonc"), '{ "d1_databases": [{ "migrations_dir": "migrations" }] }');
  return cwd;
}

describe("migrate", () => {
  it("copies package migrations with the next number and is idempotent", () => {
    const cwd = fakeProject();
    expect(migrate(cwd, {})).toBe(1);
    expect(readdirSync(join(cwd, "migrations")).sort()).toEqual(["0001_init.sql", "0002_core_0001_rate_limits.sql"]);
    expect(JSON.parse(readFileSync(join(cwd, "kashi.lock.json"), "utf8")).migrations["@kashi/core/core_0001_rate_limits.sql"]).toBe("0002_core_0001_rate_limits.sql");
    expect(migrate(cwd, {})).toBe(0);
  });
  it("doctor flags pending migrations and missing gitignore", () => {
    const cwd = fakeProject();
    expect(doctor(cwd)).toBe(1);
    migrate(cwd, {});
    writeFileSync(join(cwd, ".gitignore"), [".dev.vars", ".env", ".env.*", "*.p8", "*.p12", "*.keystore", "*.jks", "*.mobileprovision"].join("\n"));
    expect(doctor(cwd)).toBe(0);
  });
});

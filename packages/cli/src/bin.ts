#!/usr/bin/env node
/** kashi CLI entry. */
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { add } from "./commands/add.js";
import { doctor } from "./commands/doctor.js";
import { init } from "./commands/init.js";
import { migrate } from "./commands/migrate.js";
import { secrets } from "./commands/secrets.js";
import { update } from "./commands/update.js";
import { listModules, loadModule } from "./modules.js";

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")) as { version: string };
const program = new Command("kashi").version(pkg.version).description("kashi: updatable feature packages and agent skills for Hono + D1, React and Flutter");
const cwd = process.cwd();

program.command("init").description("write AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore lines and renovate.json").option("--force", "overwrite existing files").option("--no-renovate", "skip renovate.json").action((o) => init(cwd, o));
program.command("add <feature>").description("install a feature package (core, list, auth, sync, ui) or a template module (deploy-cloudflare, deploy-fastlane)").option("--no-install", "skip the package manager").option("--force", "overwrite existing module files").option("--var <KEY=VALUE...>", "set a module variable, e.g. --var APP_DIR=apps/mobile").action((f, o) => { process.exit(add(cwd, f, o, pkg.version)); });
program.command("modules").description("list template modules").action(() => { for (const m of listModules()) console.log(`  ${m.padEnd(20)} ${loadModule(m)?.description ?? ""}`); });
program.command("migrate").description("copy new package migrations into the migrations directory").option("--dry-run").option("--dir <dir>", "migrations directory").action((o) => { migrate(cwd, o); });
program.command("secrets").description("list every secret installed packages need; update .dev.vars.example and .gitignore").option("--no-write", "print only").action((o) => secrets(cwd, o));
program.command("doctor").description("check gitignore, tracked secret files, missing secrets and pending migrations").action(() => { process.exit(doctor(cwd)); });
program.command("update").description("bump every @softwareseva package, copy new migrations, refresh module templates you have not edited").option("--no-install", "skip the package manager").action((o) => update(cwd, o, pkg.version));
program.parseAsync(process.argv);

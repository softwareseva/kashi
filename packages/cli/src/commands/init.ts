/** `kashi init`: AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore lines, renovate.json. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureLines, log, templatesDir, writeIfAbsent } from "../util.js";

export function init(cwd: string, options: { force?: boolean; renovate?: boolean }) {
  log.title("kashi init");
  for (const file of ["AGENTS.md", "CLAUDE.md", "GEMINI.md"]) {
    const written = writeIfAbsent(join(cwd, file), readFileSync(join(templatesDir, file), "utf8"), options.force);
    written ? log.ok(`wrote ${file}`) : log.info(`${file} exists (use --force to overwrite)`);
  }
  const ignore = readFileSync(join(templatesDir, "gitignore"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  const added = ensureLines(join(cwd, ".gitignore"), ignore, "# kashi: secrets and build output");
  added.length ? log.ok(`added ${added.length} .gitignore lines`) : log.info(".gitignore already covers kashi secrets");
  if (options.renovate !== false) {
    const written = writeIfAbsent(join(cwd, "renovate.json"), readFileSync(join(templatesDir, "renovate.json"), "utf8"), options.force);
    written ? log.ok("wrote renovate.json (groups @softwareseva/* and kashi_* bumps)") : log.info("renovate.json exists");
  }
  log.info("next: fill the product and repository-map sections of AGENTS.md, then `npx @softwareseva/cli add <feature>`");
}

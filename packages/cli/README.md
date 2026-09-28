# @softwareseva/cli

The install/update tool for the kashi packages: scaffolds project files, installs a package and its migrations, and keeps everything in sync as new versions ship. Run it with `npx` — no install needed.

## Commands

```bash
npx @softwareseva/cli init            # AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore lines, renovate.json
npx @softwareseva/cli add auth        # install @softwareseva/auth, copy its migrations, print its secrets checklist and mount snippet
npx @softwareseva/cli add deploy-cloudflare   # GitHub Actions: test, migrate D1, deploy Worker (+ web) to staging/production
npx @softwareseva/cli add deploy-fastlane     # fastlane lanes + workflow for TestFlight/App Store and Google Play
npx @softwareseva/cli modules         # list template modules
npx @softwareseva/cli migrate         # copy new package migrations into your migrations dir (tracked in kashi.lock.json)
npx @softwareseva/cli secrets         # every secret your installed packages need: how to generate, where to store
npx @softwareseva/cli doctor          # gitignore coverage, tracked secret files, missing secrets, pending migrations
npx @softwareseva/cli update          # bump every @softwareseva/* package, copy new migrations, refresh module files you have not edited
```

Packages declare their secrets in `secrets.json` (schema: `secrets.schema.json`) and ship SQL in `migrations/`. The CLI never prints secret values.

## Template modules

Modules render templates with values detected from your project (`--var KEY=VALUE` overrides) and record a hash of each written file in `kashi.lock.json`. On `kashi update`, a file whose content still matches the recorded hash is replaced with the new template; a file you edited keeps your version and receives `<file>.kashi-new` to merge. Module secrets appear in `kashi secrets` and are checked by `kashi doctor` (including GitHub repository secrets via `gh`).

## See also

Start a new project with `kashi init`, then `kashi add <package>` for each feature. See the `kashi` skill for the full workflow.

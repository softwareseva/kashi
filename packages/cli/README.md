# @kashi/cli

```bash
npx kashi init            # AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore lines, renovate.json
npx kashi add auth        # install @kashi/auth, copy its migrations, print its secrets checklist and mount snippet
npx kashi migrate         # copy new package migrations into your migrations dir (tracked in kashi.lock.json)
npx kashi secrets         # every secret your installed packages need: how to generate, where to store
npx kashi doctor          # gitignore coverage, tracked secret files, missing secrets, pending migrations
npx kashi update          # bump every @kashi/* package, copy new migrations, report template drift
```

Packages declare their secrets in `secrets.json` (schema: `secrets.schema.json`) and ship SQL in `migrations/`. The CLI never prints secret values.

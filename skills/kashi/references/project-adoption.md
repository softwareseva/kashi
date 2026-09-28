# Adopting kashi in a project

## New Worker API

```bash
pnpm add hono zod @softwareseva/core
npx @softwareseva/cli init                          # AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore, renovate.json
npx @softwareseva/cli add auth                      # installs @softwareseva/auth, mounts /v1/auth, copies migrations, prints secrets
```

What the CLI does, if you prefer to do it by hand:

1. Copy `templates/AGENTS.md`, `templates/CLAUDE.md`, `templates/GEMINI.md` into the repo root. Fill the product summary and repository map in `AGENTS.md`. List the kashi skills that apply to the project so agents know which to load.
2. Append `templates/gitignore` to `.gitignore`.
3. Install packages. Mount routers in the composition root:

```ts
import { Hono } from "hono";
import { authRouter } from "@softwareseva/auth/server";
const app = new Hono<AppEnv>();
app.route("/v1/auth", authRouter({ providers: ["otp", "google"], /* ... */ }));
```

4. Copy package migrations: each package ships `migrations/<pkg>_NNNN_name.sql`. Copy any file not yet present into the project's `migrations/` as the next number, keeping the original name after the number so provenance is visible (`0007_auth_0001_sessions.sql`).
5. Secrets: run `npx @softwareseva/cli secrets` for the checklist, or read the package `secrets.json` directly. Each entry's `docs` field points at a heading in that package's `SECRETS.md` with the actual step-by-step instructions (which console page, which button) — `secrets.json`'s own `generate` field is only a one-line summary. Once you have a value, `wrangler secret put NAME` for production and add `NAME=` to `.dev.vars` for local development; add the same names to CI secrets when deploys run there.

## New React app

1. Install `@softwareseva/ui` and its peers; add the three CSS lines from the package README (`@import "tailwindcss"`, `@import "@softwareseva/ui/kashi.css"`, `@source ...`).
2. Install `@softwareseva/core` for the API client and `@softwareseva/auth` for `AuthProvider` and sign-in components (Phase 2 onward).
3. Keep `AGENTS.md` in the same repo if the API and web app share one; otherwise repeat step 1 of the API recipe.

## New Flutter app

1. `kashi_ui: ^0.1.0` in `pubspec.yaml`; `CupertinoApp(theme: kashiCupertinoTheme())`.
2. `kashi_core`, `kashi_auth`, `kashi_sync` as needed (Phase 4 onward).
3. Platform setup for each sign-in method is listed in the `flutter-auth` skill.

## Keeping up to date

- npm: `pnpm up "@softwareseva/*" --latest` (or `npx @softwareseva/cli update`). Read the CHANGELOG for majors.
- Flutter: `flutter pub upgrade --major-versions`.
- After any bump, diff the package `migrations/` folder against the project's and copy new files.
- App-side files copied from templates carry a header `# kashi:<skill>@<version>`. `kashi update` reports when the upstream template changed; the file stays project-owned.

## Repo-local skills

Project-specific workflows (release checklists, domain rules) go in `<repo>/skills/<name>/SKILL.md` and are listed in `AGENTS.md`. Do not copy kashi skills into projects; agents load them from the global skill directories.

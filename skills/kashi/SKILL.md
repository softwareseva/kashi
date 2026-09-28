---
name: kashi
description: Index and conventions for the kashi toolkit (Cloudflare Workers + D1 with Hono, React + Tailwind v4, Flutter). Use at the start of any project on this stack, when deciding which kashi skill or package applies (auth, pagination, offline sync, design system, deploy), or when setting up AGENTS.md, CLAUDE.md and GEMINI.md for a repository.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/cli@1.2 @softwareseva/core@1.2 @softwareseva/list@1.2 @softwareseva/auth@1.2 @softwareseva/ui@1.2 kashi_ui@1.2 kashi_core@1.2 kashi_auth@1.2 kashi_list@1.2 @softwareseva/sync@1.2 kashi_sync@1.2"
---

# kashi

kashi is a set of packages that each bundle a whole feature (API routes, React components, Flutter widgets) plus the skills that teach how to wire them. Prefer installing a package over writing the feature again. When a package does not exist yet, follow the conventions here so the code can move into one later.

## Pick the skill

| Task | Skill | Package |
|---|---|---|
| New or existing Hono API on Workers + D1 | `hono-d1-api` | `@softwareseva/core` |
| Sign in, sessions, refresh tokens, roles | `auth-sessions` | `@softwareseva/auth` |
| Phone sign-in with a WhatsApp or SMS code | `auth-whatsapp-otp` | `@softwareseva/auth` |
| Google sign-in (web and mobile) | `auth-google` | `@softwareseva/auth` |
| Sign in with Apple (web and mobile) | `auth-apple` | `@softwareseva/auth` |
| Facebook Login (web and mobile) | `auth-facebook` | `@softwareseva/auth` |
| Passkeys / WebAuthn, the default anonymous sign-in | `auth-passkeys` | `@softwareseva/auth` |
| Cross-site SSO: sign in with another kashi site's account | `auth-federation` | `@softwareseva/auth` |
| List endpoint with search, sort, paging on D1 | `d1-list-pagination` | `@softwareseva/list` |
| Offline-first sync endpoints | `sync-endpoints` | `@softwareseva/sync` |
| Offline-first data in React with RxDB | `react-offline-sync` | `@softwareseva/sync` |
| React app styling and primitives | `kashi-ui-web` | `@softwareseva/ui` |
| Directory or admin table screen in React | `react-data-table` | `@softwareseva/list` |
| Calling the API from React | `api-client-react` | `@softwareseva/core`, `@softwareseva/auth` |
| Flutter app styling and widgets | `kashi-ui-flutter` | `kashi_ui` |
| Calling the API from Flutter | `flutter-api-client` | `kashi_core` |
| Sign-in flows in Flutter | `flutter-auth` | `kashi_auth` |
| Offline data with Drift in Flutter | `flutter-drift-sync` | `kashi_sync` |
| Ship a Flutter app to TestFlight / Play | `deploy-flutter-fastlane` | `@softwareseva/cli` templates |
| Deploy a Worker with D1 migrations in CI | `deploy-cloudflare` | `@softwareseva/cli` templates |

Every skill above is available. `references/roadmap.md` records what shipped in which phase.

## Set up a project

1. Add `AGENTS.md` from `templates/AGENTS.md` and fill the product and repository-map sections. Add `CLAUDE.md` and `GEMINI.md` from the templates; they only point to `AGENTS.md`.
2. Add the `.gitignore` lines from `templates/gitignore` (secrets, build output).
3. For npm packages: `pnpm add @softwareseva/<name>`. For Flutter: add `kashi_<name>: ^x.y.z` to `pubspec.yaml`.
4. When a package ships SQL, copy its `migrations/*.sql` into the project's migrations directory with the next sequence number. Never edit an applied migration.
5. Read each installed package's `secrets.json`, generate the secrets it lists, store them where it says (`wrangler secret put`, `.dev.vars`, CI secrets), and confirm they are gitignored.

Full recipe with examples: `references/project-adoption.md`.

## Conventions (summary)

- **Layers**: `web -> contracts <- routes -> services -> repositories -> D1`. Routes parse input and shape responses; services hold business rules; repositories hold all SQL. No SQL in routes or services.
- **Envelope**: success is `{ data }`; failure is `{ code, message, requestId, fields? }`. Throw `ApiError` for expected failures; the composition root normalises everything else to a 500 with a `requestId`.
- **Versioned API**: routes live under `/v1`. Protected mutations need the role check and, for cookie sessions, CSRF protection.
- **Secrets**: store opaque tokens only as hashes, compare with constant-time helpers, never log credentials, codes or raw tokens.
- **Lists**: allowlisted sort keys and stable `(sort_value, id)` keyset cursors; clear the cursor when a filter, search, limit or sort changes; keep list state in the URL on the web.
- **Migrations**: immutable, numbered, forward-safe for existing data, applied explicitly (never as a side effect of a code change).
- **Files**: start with a one-line overview comment; stay under 400 lines; no raw hex colours outside the token file.
- **Dependencies**: latest stable versions, no pre-releases; pin plugin versions in Flutter.
- **Deploys and production migrations are explicit actions**: do not run them because code is ready; report what was verified and what still needs to run.

Full text: `references/conventions.md`.

## Update packages

`npx @softwareseva/cli update` bumps every `@softwareseva/*` package, copies new package migrations into the project, and refreshes files written by template modules (deploy workflows, fastlane lanes): files you have not edited are updated in place, edited ones get the new version beside them as `<file>.kashi-new`. For Flutter packages run `flutter pub upgrade --major-versions`.

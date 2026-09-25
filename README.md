# kashi

Reusable, updatable building blocks for apps on **Cloudflare Workers + D1 (Hono)**, **React + Tailwind v4**, and **Flutter**, plus the **Agent Skills** that teach AI coding agents (Claude Code, Codex/ChatGPT, Antigravity, and any other skills-compatible agent) how to use them.

Each feature ships as a package that bundles every layer, so one version bump updates the API routes and the UI together:

| Feature | npm (server + React) | pub.dev (Flutter) | Skills |
|---|---|---|---|
| Core: envelope, errors, crypto, ids, rate limits, API client | `@kashi/core` | `kashi_core` | `hono-d1-api`, `api-client-react`, `flutter-api-client` |
| Auth: JWT sessions, WhatsApp OTP, Google, Apple, passkeys | `@kashi/auth` | `kashi_auth` | `auth-sessions`, `auth-whatsapp-otp`, `auth-google`, `auth-apple`, `auth-passkeys`, `flutter-auth` |
| Lists: keyset pagination, search, sort, DataTable | `@kashi/list` | `kashi_list` | `d1-list-pagination`, `react-data-table` |
| Offline sync: outbox, push/pull | `@kashi/sync` | `kashi_sync` | `sync-endpoints`, `flutter-drift-sync` |
| Design system: tokens, primitives (light + dark) | `@kashi/ui` | `kashi_ui` | `kashi-ui-web`, `kashi-ui-flutter` |
| Deploy: fastlane (iOS/Android), Cloudflare | `@kashi/cli` templates | | `deploy-flutter-fastlane`, `deploy-cloudflare` |

Status: all six build phases are done (18 skills, 6 npm packages, 5 Flutter packages, example API, web and Flutter apps). Not yet published to npm or pub.dev. Roadmap in `skills/kashi/references/roadmap.md`.

## Use the skills

```bash
git clone https://github.com/softwareseva/kashi.git
cd kashi && scripts/install.sh
```

This symlinks every skill into `~/.claude/skills`, `~/.agents/skills` (Codex, ChatGPT) and `~/.gemini/config/skills` (Antigravity). Re-run after `git pull`. Use `--copy` for agents that ignore symlinks.

## Use the packages

```bash
npx kashi init            # AGENTS.md, pointers, .gitignore, renovate
npx kashi add auth        # installs @kashi/auth, mounts routes, copies migrations, prints the secrets checklist
npx kashi add deploy-cloudflare   # CI deploy of the Worker (and web app) with D1 migrations, staging and production
npx kashi add deploy-fastlane     # TestFlight / App Store and Google Play lanes plus a release workflow
npx kashi secrets         # every secret your packages and modules need: how to create it, where to store it
npx kashi update          # bumps @kashi/* packages, copies new migrations, refreshes module files you have not edited
npx kashi doctor          # checks gitignore, tracked secret files, local, Worker and GitHub secrets, pending migrations
```

## Repo layout

```
packages/   npm packages (@kashi/*)         dart/      pub.dev packages (kashi_*)
skills/     Agent Skills (SKILL.md)         examples/  api, web, app that consume the packages
scripts/    install.sh, validate.sh         .github/   ci and release
```

## Contributing

`pnpm install && pnpm run check` runs build, typecheck, token sync and skill validation. Dart: `flutter pub get && flutter analyze dart`. Add a changeset for any published npm package change. MIT licensed.

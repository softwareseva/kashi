# Agent guide for this repository

This repository is the source of both the `@softwareseva/*` / `kashi_*` packages and the Agent Skills that teach how to use them. `CLAUDE.md` and `GEMINI.md` point here.

## Before changing anything

1. Read `skills/kashi/SKILL.md`; it is the index and holds the conventions every package follows.
2. Skills are the public contract: keep `SKILL.md` under 500 lines, keep frontmatter to the Agent Skills spec fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`), reference only sibling `references/` and `templates/` files, and never mention private projects or home-directory paths.
3. `packages/tokens/tokens.json` is the single source for design tokens. Edit it first, then mirror in `packages/ui/src/kashi.css` and `dart/kashi_ui/lib/src/tokens.dart`. `pnpm run check:tokens` must pass.
4. Published packages need a changeset (`pnpm changeset`). Dart packages don't take a changeset themselves — `.github/workflows/release.yml` bumps and publishes them automatically (see point 6) once the npm release lands. Only bump a `dart/kashi_*/pubspec.yaml`/`CHANGELOG.md` by hand when that PR makes a real Flutter-side change ahead of the next npm lockstep bump; the automation detects it's already at the target version and skips it.
5. Run `pnpm run check` and `flutter analyze dart` before handoff. Never publish from a working tree; releases run in CI.
6. **Versioning is lockstep across every published package, npm and dart alike.** `@softwareseva/core`, `auth`, `ui`, `list`, `sync`, `cli` are one fixed group in `.changeset/config.json` — any changeset bumps all of them together to the same version. The `kashi_*` dart packages don't go through changesets, but `.github/workflows/release.yml` automatically runs `scripts/sync-dart-versions.sh <version>` right after a successful npm publish: it bumps every `dart/kashi_*/pubspec.yaml` and prepends a generic lockstep `CHANGELOG.md` entry (skipping any package already at that version), commits straight to `main`, then tags and pushes each bumped package via `scripts/release-dart.sh` to trigger `.github/workflows/pub-release.yml`. `@softwareseva/tokens` is exempt (private, internal-only, stays unversioned at `0.0.0`). **Never test `scripts/sync-dart-versions.sh` (or `scripts/release-dart.sh`) against a real version against the real `origin` remote** — both commit and push for real; use a disposable local clone/remote to test changes to either script.
7. **A package (or CLI template module) that ships any secret must ship a `SECRETS.md` next to its `secrets.json`, and every entry in `secrets.json` needs a `docs` field pointing at that entry's heading** (e.g. `"docs": "SECRETS.md#google_client_id"`, matching a `### GOOGLE_CLIENT_ID` heading). `secrets.json`'s `generate` field stays a one-line summary — the real walkthrough (which console, which menu, which button, what to paste where) lives in `SECRETS.md`, one `##`/`###` section per provider/secret. This is the machine-readable half (`secrets.json`, read by `npx @softwareseva/cli secrets`/`doctor` and indexed in `llms.txt`/`llms-full.txt`) paired with the human-readable half (`SECRETS.md`, linked from the package's own README and from `llms.txt`). Add `SECRETS.md` to the package's `package.json` `files` array or it won't ship to npm.

## Extending an existing package

Adding a route, component, or method to a package that already exists (not a new package — see `skills/kashi/SKILL.md`'s scaffolding conventions for that):

1. Find the matching skill first (`skills/kashi/SKILL.md`'s "Pick the skill" table) and read it before writing code — it documents the layer boundaries and recipe for that package.
2. Follow the existing layering: `web -> contracts <- routes -> services -> repositories -> D1`. No SQL in routes or services.
3. Add the test under `test/`, mirroring the new/changed `src/` module name — don't create a parallel test structure.
4. If the change alters documented behavior (a new param, a changed response shape, a new recipe step), update the skill's `SKILL.md` or its `templates/`/`references/` in the same change — skills drift out of sync silently otherwise.
5. If it touches design tokens, edit `packages/tokens/tokens.json` first, mirror into `packages/ui/src/kashi.css` and `dart/kashi_ui/lib/src/tokens.dart`, then `pnpm run check:tokens`.
6. Run `pnpm run check` (and `flutter analyze dart` for a dart-side change) before handoff.
7. Add a changeset (`pnpm changeset`) for any published package change — remember it bumps the whole fixed group per point 6 above, not just this package.

## Layout

- `packages/<name>/` npm package with `src/`, built by `tsc` to `dist/`, subpath exports declared in `package.json`.
- `dart/<name>/` Flutter package in the pub workspace declared by the root `pubspec.yaml`.
- `skills/<name>/` one skill: `SKILL.md`, `references/`, `templates/`.
- `examples/` apps that consume the packages through the workspace and act as the integration test.
- `scripts/install.sh` links skills into agent directories; `scripts/validate.sh` validates skills; `scripts/release-dart.sh` tags and pushes a dart/ package release; `scripts/sync-dart-versions.sh` bumps every dart/kashi_* package to a given version and releases each (run automatically by `.github/workflows/release.yml`, see point 6 above).

## Style

TypeScript strict, ESM only, no default exports from packages. Dart follows `flutter_lints`. Keep files under 400 lines. Every published file starts with a one-line `/** ... */` or `///` overview.

## Testing

Every npm package uses vitest, with tests under `test/` mirroring `src/` module names. Logic-only packages (`core`, `auth`, `list`, `sync`, `cli`) test with plain vitest (`vitest.config.ts` with `include: ["test/**/*.test.ts"]`, no DOM). React component packages (`ui`) additionally need a DOM: use `environment: "jsdom"`, `@testing-library/react` + `@testing-library/user-event` for rendering and interaction, and a `test/setup.ts` (wired via `setupFiles`) that imports `@testing-library/jest-dom/vitest`, registers `afterEach(() => cleanup())`, and polyfills what jsdom is missing for Radix primitives (`scrollIntoView`, `hasPointerCapture`/`releasePointerCapture`, and a `PointerEvent` that extends `MouseEvent` — extending the bare `Event` class breaks native click/submit handling in jsdom).

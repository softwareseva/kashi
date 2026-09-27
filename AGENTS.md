# Agent guide for this repository

This repository is the source of both the `@softwareseva/*` / `kashi_*` packages and the Agent Skills that teach how to use them. `CLAUDE.md` and `GEMINI.md` point here.

## Before changing anything

1. Read `skills/kashi/SKILL.md`; it is the index and holds the conventions every package follows.
2. Skills are the public contract: keep `SKILL.md` under 500 lines, keep frontmatter to the Agent Skills spec fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`), reference only sibling `references/` and `templates/` files, and never mention private projects or home-directory paths.
3. `packages/tokens/tokens.json` is the single source for design tokens. Edit it first, then mirror in `packages/ui/src/kashi.css` and `dart/kashi_ui/lib/src/tokens.dart`. `pnpm run check:tokens` must pass.
4. Published packages need a changeset (`pnpm changeset`). Dart packages bump `version` and `CHANGELOG.md` by hand, then release with `scripts/release-dart.sh <package>`.
5. Run `pnpm run check` and `flutter analyze dart` before handoff. Never publish from a working tree; releases run in CI.
6. **Versioning is lockstep across every published package, npm and dart alike.** `@softwareseva/core`, `auth`, `ui`, `list`, `sync`, `cli` are one fixed group in `.changeset/config.json` — any changeset bumps all of them together to the same version. The `kashi_*` dart packages don't go through changesets, so when the npm group's version moves, bump every `dart/kashi_*/pubspec.yaml` and `CHANGELOG.md` by hand to the same number (even packages with no functional change — note that in the changelog) before running `scripts/release-dart.sh` for each. `@softwareseva/tokens` is exempt (private, internal-only, stays unversioned at `0.0.0`).

## Layout

- `packages/<name>/` npm package with `src/`, built by `tsc` to `dist/`, subpath exports declared in `package.json`.
- `dart/<name>/` Flutter package in the pub workspace declared by the root `pubspec.yaml`.
- `skills/<name>/` one skill: `SKILL.md`, `references/`, `templates/`.
- `examples/` apps that consume the packages through the workspace and act as the integration test.
- `scripts/install.sh` links skills into agent directories; `scripts/validate.sh` validates skills; `scripts/release-dart.sh` tags and pushes a dart/ package release.

## Style

TypeScript strict, ESM only, no default exports from packages. Dart follows `flutter_lints`. Keep files under 400 lines. Every published file starts with a one-line `/** ... */` or `///` overview.

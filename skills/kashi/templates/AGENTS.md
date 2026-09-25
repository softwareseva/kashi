# Repository agent guide

This file is the canonical instruction entry point for any coding agent working in this repository. It is tool- and vendor-neutral. `CLAUDE.md` and `GEMINI.md` point here.

## Product and current state

<!-- Two or three sentences: what the product does, who uses it, what is live and what is in progress. -->

## Start here

1. Read this file and the closest relevant code and tests.
2. Load the kashi skills that apply to this project: `kashi`, <!-- e.g. `hono-d1-api`, `auth-sessions`, `d1-list-pagination`, `react-data-table`, `flutter-auth` -->.
3. Read the matching repo-local skill when the task fits one: <!-- `skills/<name>/SKILL.md` -->.
4. Check `git status --short` and preserve unrelated changes.
5. The code and migrations are the source of truth; planning docs are context.

## Repository map

<!-- One line per top-level directory: what lives there and what must not be hand-edited. -->

## Rules specific to this project

<!-- Domain invariants, identity model, external integrations, anything an agent would otherwise get wrong. -->

## Verification

```bash
<!-- the one command that runs typecheck, tests and policy checks -->
```

Deployments, production migrations and secret changes are explicit external actions. Report what changed, what was verified, and what still needs to run.

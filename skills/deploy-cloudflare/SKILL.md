---
name: deploy-cloudflare
description: Deploy a Hono Worker with D1 (and optionally a Vite web app) to Cloudflare from GitHub Actions with the kashi CLI, covering staging and production environments, one D1 database per environment, migrations applied before deploy, per-environment secrets, the API token and account id, and GitHub environment approvals. Use when setting up CI/CD for a Worker, adding a staging environment, deploying a web app on Workers static assets, or fixing a failed Cloudflare deploy.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/cli@0.1"
---

# Deploy to Cloudflare

`npx @softwareseva/cli add deploy-cloudflare` writes GitHub Actions workflows and records them in `kashi.lock.json`, so `npx @softwareseva/cli update` refreshes them later unless you edited them.

```bash
npx @softwareseva/cli add deploy-cloudflare                         # API only; detects the directory with wrangler.jsonc
npx @softwareseva/cli add deploy-cloudflare --var WEB_DIR=apps/web  # also deploy a Vite app with Workers static assets
```

## What the workflows do

| Trigger | Environment |
|---|---|
| push to `main` touching the API or web directory | `staging` |
| GitHub release published | `production` |
| manual run | chosen |

API job: install, typecheck, test, `wrangler d1 migrations apply DB --remote --env <target>`, then `wrangler deploy --env <target>`. Migrations run **before** the new code, so code never meets an older schema; write migrations that the previous release can also run against (add columns, backfill, then remove old ones in a later release).

Web job: build with `VITE_API_URL` from the GitHub environment variable, then `wrangler deploy --env <target>` using `assets` with SPA fallback (`templates` write `wrangler.jsonc` in the web directory if missing).

## One-time setup

1. Add `env.staging` and `env.production` to the API `wrangler.jsonc`, each with its own `vars` and `d1_databases` (`references/wrangler-envs.md`). Bindings are not inherited by environments, so repeat `d1_databases` in each.
2. `wrangler d1 create <name>-staging` and `wrangler d1 create <name>-production`; paste the ids.
3. Worker secrets per environment: `wrangler secret put JWT_SECRET --env staging` and again with `--env production` (`npx @softwareseva/cli secrets` lists them all).
4. Repository secrets: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (see `npx @softwareseva/cli secrets` for how to create the token with Workers and D1 edit rights).
5. GitHub > Settings > Environments: create `staging` and `production`; add required reviewers to `production`; set `VITE_API_URL` per environment for the web job.
6. Custom domains: `routes: [{ "pattern": "api.example.com", "custom_domain": true }]` in the environment.

`npx @softwareseva/cli doctor` then checks gitignore coverage, local secrets, deployed Worker secrets and GitHub secrets.

## Rules

- Never run `wrangler deploy` or `--remote` migrations as a side effect of finishing code. Deploys happen through the workflow; report "merge to main to deploy to staging" as the next step.
- Test a migration locally on existing data and on an empty database before pushing (`wrangler d1 migrations apply DB --local`).
- Keep `compatibility_date` recent and identical across environments.
- Roll back code with `wrangler rollback --env production`; database changes need a forward migration.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Authentication error [code: 10000]` | token lacks Workers Scripts or D1 edit, or wrong account id |
| `Couldn't find a D1 DB with the name or binding 'DB'` | the environment section has no `d1_databases` |
| deploy succeeds, requests fail with missing secret | secret set without `--env`; set it per environment |
| migration failed halfway | fix forward with a new migration; D1 applies each file in a transaction |

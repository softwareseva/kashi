# Generating secrets for deploy-cloudflare

Step-by-step instructions for every secret in [`secrets.json`](secrets.json). These are consumed by the GitHub Actions workflow this module installs (`.github/workflows/deploy.yml`), which needs its own Cloudflare credentials distinct from anything you use locally with `wrangler login`.

Both values are stored the same way: **`ci-secret`** — a GitHub repository secret, set with `gh secret set NAME` (or Settings → Secrets and variables → Actions → New repository secret in the GitHub UI).

## CLOUDFLARE_API_TOKEN

A scoped API token the workflow uses to deploy the Worker and run D1 migrations — not your personal Cloudflare login.

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → click your profile icon (top right) → **My Profile** → **API Tokens**.
2. **Create Token** → find the **Edit Cloudflare Workers** template → **Use template**.
3. Under **Permissions**, add one more row: **Account** → **D1** → **Edit** (the template only grants Workers Scripts edit by default; migrations need D1 too).
4. Under **Account Resources**, restrict it to your specific account rather than "All accounts".
5. **Continue to summary** → **Create Token**. Copy the token now — Cloudflare shows it exactly once.

```bash
gh secret set CLOUDFLARE_API_TOKEN
# paste the token, then Ctrl-D
```

Rotate yearly, or immediately if someone with access to it leaves the team — revoke the old token from the same API Tokens page and create a new one.

## CLOUDFLARE_ACCOUNT_ID

Your Cloudflare account's identifier (not secret in the sense of being sensitive, but the workflow needs it as a repo secret alongside the token so both live next to each other).

Either:

- Dashboard → **Workers & Pages** → the account id is shown in the right sidebar, or
- Run `wrangler whoami` if you're already logged in locally.

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
# paste the account id, then Ctrl-D
```

## See also

The `deploy-cloudflare` skill for the full workflow (staging/production environments, per-environment D1 databases, migrations-before-deploy ordering) and its `references/wrangler-envs.md` for the `wrangler.jsonc` shape these credentials deploy.

# wrangler.jsonc with environments

```jsonc
{
  "name": "my-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  // top level = local development (wrangler dev)
  "vars": { "ENVIRONMENT": "development", "WEB_ORIGIN": "http://localhost:5173" },
  "d1_databases": [{ "binding": "DB", "database_name": "my-api-dev", "database_id": "<local id>", "migrations_dir": "migrations" }],
  "observability": { "enabled": true },
  "env": {
    "staging": {
      "vars": { "ENVIRONMENT": "staging", "WEB_ORIGIN": "https://staging.example.com", "AUTH_URL": "https://api-staging.example.com/v1/auth" },
      "d1_databases": [{ "binding": "DB", "database_name": "my-api-staging", "database_id": "<id>", "migrations_dir": "migrations" }],
      "routes": [{ "pattern": "api-staging.example.com", "custom_domain": true }]
    },
    "production": {
      "vars": { "ENVIRONMENT": "production", "WEB_ORIGIN": "https://app.example.com", "AUTH_URL": "https://api.example.com/v1/auth" },
      "d1_databases": [{ "binding": "DB", "database_name": "my-api-production", "database_id": "<id>", "migrations_dir": "migrations" }],
      "routes": [{ "pattern": "api.example.com", "custom_domain": true }]
    }
  }
}
```

- `vars`, `d1_databases`, `kv_namespaces`, `r2_buckets`, `routes` and `triggers` are **not inherited**; list them in every environment.
- The deployed Worker is named `<name>-<env>` unless the environment sets `name`.
- Validate without deploying: `wrangler deploy --dry-run --env staging --outdir /tmp/dry`.
- `ENVIRONMENT` other than `development`/`test` turns on `Secure` `__Host-` cookies in `@softwareseva/auth`.

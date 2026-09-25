/// <reference path="../node_modules/@cloudflare/vitest-plugin/types/cloudflare-test.d.ts" />
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}

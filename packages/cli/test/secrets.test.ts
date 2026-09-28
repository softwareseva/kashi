import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectSecrets } from "../src/commands/secrets.js";

function fakeProject() {
  const cwd = mkdtempSync(join(tmpdir(), "kashi-"));
  const pkg = join(cwd, "node_modules", "@softwareseva", "auth");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@softwareseva/auth", version: "1.3.0" }));
  writeFileSync(
    join(pkg, "secrets.json"),
    JSON.stringify({
      package: "@softwareseva/auth",
      secrets: [{ name: "JWT_SECRET", description: "HMAC key.", generate: "openssl rand -base64 48", store: ["wrangler-secret", "dev-vars"], docs: "SECRETS.md#jwt_secret" }],
    }),
  );
  return { cwd, pkgDir: pkg };
}

describe("collectSecrets", () => {
  it("carries the installed package's dir so a docs path can be resolved", () => {
    const { cwd, pkgDir } = fakeProject();
    const all = collectSecrets(cwd);
    expect(all).toHaveLength(1);
    expect(all[0]!.pkg).toBe("@softwareseva/auth");
    expect(all[0]!.dir).toBe(pkgDir);
    expect(all[0]!.entry.docs).toBe("SECRETS.md#jwt_secret");
    expect(join(all[0]!.dir, all[0]!.entry.docs!)).toBe(join(pkgDir, "SECRETS.md#jwt_secret"));
  });
});

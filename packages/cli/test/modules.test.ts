import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addModule, updateModules } from "../src/commands/modules.js";
import { sha } from "../src/modules.js";

function workerProject() {
  const cwd = mkdtempSync(join(tmpdir(), "kashi-mod-"));
  mkdirSync(join(cwd, "apps/api"), { recursive: true });
  writeFileSync(join(cwd, "apps/api/wrangler.jsonc"), "{}");
  return cwd;
}
function flutterProject() {
  const cwd = mkdtempSync(join(tmpdir(), "kashi-mod-"));
  mkdirSync(join(cwd, "mobile/ios/Runner.xcodeproj"), { recursive: true });
  mkdirSync(join(cwd, "mobile/android/app"), { recursive: true });
  writeFileSync(join(cwd, "mobile/pubspec.yaml"), "name: x");
  writeFileSync(join(cwd, "mobile/ios/Runner.xcodeproj/project.pbxproj"), "PRODUCT_BUNDLE_IDENTIFIER = com.acme.app;\nPRODUCT_BUNDLE_IDENTIFIER = com.acme.app.RunnerTests;");
  writeFileSync(join(cwd, "mobile/android/app/build.gradle.kts"), 'android { defaultConfig { applicationId = "com.acme.app" } }');
  return cwd;
}

describe("modules", () => {
  it("deploy-cloudflare detects the API dir, renders placeholders, keeps GitHub expressions", () => {
    const cwd = workerProject();
    expect(addModule(cwd, "deploy-cloudflare", "0.1.0", {})).toBe(0);
    const wf = readFileSync(join(cwd, ".github/workflows/deploy-api.yml"), "utf8");
    expect(wf).toContain("working-directory: apps/api");
    expect(wf).toContain("${{ secrets.CLOUDFLARE_API_TOKEN }}");
    expect(wf).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(existsSync(join(cwd, ".github/workflows/deploy-web.yml"))).toBe(false);
    const lock = JSON.parse(readFileSync(join(cwd, "kashi.lock.json"), "utf8"));
    expect(lock.modules["deploy-cloudflare"].vars.API_DIR).toBe("apps/api");
  });

  it("deploy-fastlane detects bundle id and package, writes lanes and gitignore", () => {
    const cwd = flutterProject();
    expect(addModule(cwd, "deploy-fastlane", "0.1.0", { vars: { APPLE_TEAM_ID: "TEAM000001" } })).toBe(0);
    expect(readFileSync(join(cwd, "mobile/ios/fastlane/Appfile"), "utf8")).toContain('app_identifier("com.acme.app")');
    expect(readFileSync(join(cwd, "mobile/ios/fastlane/Appfile"), "utf8")).toContain('team_id("TEAM000001")');
    expect(readFileSync(join(cwd, "mobile/android/fastlane/Appfile"), "utf8")).toContain('package_name("com.acme.app")');
    expect(readFileSync(join(cwd, ".github/workflows/mobile-release.yml"), "utf8")).toContain("working-directory: mobile/ios");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toContain("key.properties");
  });

  it("update refreshes untouched files, writes .kashi-new for edited ones, and keeps variables", () => {
    const cwd = workerProject();
    addModule(cwd, "deploy-cloudflare", "0.1.0", {});
    const file = join(cwd, ".github/workflows/deploy-api.yml");
    const lockPath = join(cwd, "kashi.lock.json");
    // Simulate an older template that the user never edited.
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    writeFileSync(file, "old template\n");
    lock.modules["deploy-cloudflare"].files[".github/workflows/deploy-api.yml"] = sha("old template\n");
    writeFileSync(lockPath, JSON.stringify(lock));
    let result = updateModules(cwd, "0.2.0");
    expect(result.updated).toEqual([".github/workflows/deploy-api.yml"]);
    expect(readFileSync(file, "utf8")).toContain("working-directory: apps/api");

    // Now the user edits it, and upstream changes again.
    const lock2 = JSON.parse(readFileSync(lockPath, "utf8"));
    lock2.modules["deploy-cloudflare"].files[".github/workflows/deploy-api.yml"] = sha("previous upstream\n");
    writeFileSync(lockPath, JSON.stringify(lock2));
    writeFileSync(file, "my custom workflow\n");
    result = updateModules(cwd, "0.3.0");
    expect(result.conflicts).toEqual([".github/workflows/deploy-api.yml"]);
    expect(readFileSync(file, "utf8")).toBe("my custom workflow\n");
    expect(readFileSync(`${file}.kashi-new`, "utf8")).toContain("working-directory: apps/api");

    // A file that already matches upstream is left alone.
    writeFileSync(file, readFileSync(`${file}.kashi-new`, "utf8"));
    result = updateModules(cwd, "0.3.0");
    expect(result).toEqual({ updated: [], conflicts: [] });
  });
});

// Proves the @source lines work: classes that appear only inside the packages must be in the built CSS.
import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
execSync("vite build --logLevel error", { stdio: "inherit" });
const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css")).map((f) => readFileSync(`dist/assets/${f}`, "utf8")).join("\n");
const required = {
  "@kashi/ui (Checkbox)": ".data-\\[state\\=checked\\]\\:bg-saffron-strong",
  "@kashi/list/react (DataTable)": ".divide-border",
  "@kashi/auth/react (SignIn)": ".max-w-sm",
  "kashi tokens": "--saffron:",
};
const missing = Object.entries(required).filter(([, needle]) => !css.includes(needle));
if (missing.length) { console.error("missing from built CSS:", missing.map(([k]) => k).join(", ")); process.exit(1); }
console.log(`built CSS contains package classes (${Object.keys(required).join(", ")})`);

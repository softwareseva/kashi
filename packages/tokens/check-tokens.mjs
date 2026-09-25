#!/usr/bin/env node
// Fails when packages/ui/src/kashi.css or dart/kashi_ui/lib/src/tokens.dart
// disagree with tokens.json. tokens.json is the single source of truth.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const tokens = JSON.parse(readFileSync(join(here, "tokens.json"), "utf8"));
const css = readFileSync(join(root, "packages/ui/src/kashi.css"), "utf8");
const dart = readFileSync(join(root, "dart/kashi_ui/lib/src/tokens.dart"), "utf8");

const errors = [];
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// CSS: light values live in :root, dark values in .dark
const block = (selector) => {
  const m = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : "";
};
const rootCss = block(":root"), darkCss = block(".dark");
// Resolve `--x: var(--y)` aliases so a token may point at another token.
const cssValues = (blockCss) => {
  const raw = Object.fromEntries([...blockCss.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]));
  const resolve = (v, depth = 0) => {
    const m = v && v.match(/^var\(--([a-z0-9-]+)\)$/i);
    return m && depth < 5 ? resolve(raw[m[1]], depth + 1) : v;
  };
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, resolve(v)]));
};
for (const [mode, blockCss] of [["light", rootCss], ["dark", darkCss]]) {
  const values = cssValues(blockCss);
  for (const [name, hex] of Object.entries(tokens.color[mode])) {
    if ((values[name] || "").toLowerCase() !== hex.toLowerCase()) errors.push(`css ${mode}: --${name} should be ${hex}, found ${values[name]}`);
  }
}
for (const [name, px] of Object.entries(tokens.radius)) {
  if (!new RegExp(`--radius-${name}:\\s*${px}px`).test(css)) errors.push(`css: --radius-${name} should be ${px}px`);
}
for (const [name, t] of Object.entries(tokens.type)) {
  if (!new RegExp(`--text-${name}:\\s*${t.size}px`).test(css)) errors.push(`css: --text-${name} should be ${t.size}px`);
  if (!new RegExp(`--text-${name}--line-height:\\s*${t.lineHeight}px`).test(css)) errors.push(`css: --text-${name}--line-height should be ${t.lineHeight}px`);
}

// Dart: KColors.light / KColors.dark blocks with Color(0xFFRRGGBB)
const dartBlock = (label) => {
  const m = dart.match(new RegExp(`static const ${label} = KColors\\(([\\s\\S]*?)\\);`));
  return m ? m[1] : "";
};
for (const [mode, blockDart] of [["light", dartBlock("light")], ["dark", dartBlock("dark")]]) {
  for (const [name, hex] of Object.entries(tokens.color[mode])) {
    const re = new RegExp(`${kebabToCamel(name)}:\\s*Color\\(0xFF${hex.slice(1)}\\)`, "i");
    if (!re.test(blockDart)) errors.push(`dart ${mode}: ${kebabToCamel(name)} should be 0xFF${hex.slice(1).toUpperCase()}`);
  }
}
for (const [name, px] of Object.entries(tokens.space)) {
  if (!new RegExp(`static const double ${name} = ${px};`).test(dart)) errors.push(`dart: KSpace.${name} should be ${px}`);
}
for (const [name, px] of Object.entries(tokens.radius)) {
  if (!new RegExp(`static const double ${name} = ${px};`).test(dart)) errors.push(`dart: KRadius.${name} should be ${px}`);
}
for (const [name, t] of Object.entries(tokens.type)) {
  const field = kebabToCamel(name);
  if (!new RegExp(`static const TextStyle ${field} = TextStyle\\([^;]*fontSize: ${t.size},[^;]*height: ${t.lineHeight} / ${t.size}`).test(dart))
    errors.push(`dart: KText.${field} should be size ${t.size} / line-height ${t.lineHeight}`);
}

if (errors.length) { console.error("tokens out of sync:\n  " + errors.join("\n  ")); process.exit(1); }
console.log(`tokens in sync (${Object.keys(tokens.color.light).length} colours, ${Object.keys(tokens.type).length} text styles)`);

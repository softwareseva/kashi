#!/usr/bin/env bash
# Validate every skill: spec conformance (skills-ref), name == directory,
# SKILL.md under 500 lines, and no absolute or home-directory paths in bodies.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
for skill in "$REPO"/skills/*/; do
  skill="${skill%/}"; name="$(basename "$skill")"
  [[ -f "$skill/SKILL.md" ]] || { echo "FAIL $name: no SKILL.md"; fail=1; continue; }
  fm_name="$(awk '/^---/{c++; next} c==1 && /^name:/{sub(/^name:[ ]*/,""); print; exit}' "$skill/SKILL.md")"
  [[ "$fm_name" == "$name" ]] || { echo "FAIL $name: frontmatter name '$fm_name' != dir"; fail=1; }
  lines="$(wc -l < "$skill/SKILL.md" | tr -d ' ')"
  [[ "$lines" -le 500 ]] || { echo "FAIL $name: SKILL.md has $lines lines (>500)"; fail=1; }
  if grep -nE '(~/|/Users/|/home/)' "$skill/SKILL.md" "$skill"/references/*.md 2>/dev/null | grep -v 'install.sh' | grep -q .; then
    echo "FAIL $name: absolute or home path in skill text"; grep -nE '(~/|/Users/|/home/)' "$skill/SKILL.md" "$skill"/references/*.md 2>/dev/null | grep -v install.sh; fail=1
  fi
  if command -v npx >/dev/null; then
    npx --yes skills-ref@0.1.5 validate "$skill" >/tmp/skills-ref.out 2>&1 || { echo "FAIL $name: skills-ref"; cat /tmp/skills-ref.out; fail=1; }
  fi
  echo "ok   $name"
done
exit $fail

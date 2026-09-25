#!/usr/bin/env bash
# Link (or copy) every skill in this repo into the skill directories of
# Claude Code, Codex/ChatGPT and Antigravity. Safe to re-run.
#
#   scripts/install.sh            # symlink (default)
#   scripts/install.sh --copy     # copy instead of symlink (for agents that ignore symlinks)
#   scripts/install.sh --prune    # also remove stale entries that point into this repo
#   scripts/install.sh --no-pull  # skip git pull
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=link; PRUNE=0; PULL=1
for arg in "$@"; do
  case "$arg" in
    --copy) MODE=copy ;;
    --link) MODE=link ;;
    --prune) PRUNE=1 ;;
    --no-pull) PULL=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ $PULL -eq 1 && -d "$REPO/.git" ]] && git -C "$REPO" remote get-url origin >/dev/null 2>&1; then
  git -C "$REPO" pull --ff-only || echo "warning: git pull failed, continuing with local copy" >&2
fi

TARGETS=(
  "$HOME/.claude/skills"          # Claude Code
  "$HOME/.agents/skills"          # Codex CLI, ChatGPT desktop, Codex IDE extension
  "$HOME/.gemini/config/skills"   # Antigravity IDE
)
[[ -d "$HOME/.gemini/antigravity-cli" ]] && TARGETS+=("$HOME/.gemini/antigravity-cli/skills")

install_one() {
  local src="$1" dest="$2"
  if [[ $MODE == link ]]; then
    if [[ -L "$dest" ]]; then rm "$dest"; elif [[ -e "$dest" ]]; then echo "skip (exists, not a link): $dest"; return; fi
    ln -s "$src" "$dest"
  else
    if [[ -L "$dest" ]]; then rm "$dest"; fi
    mkdir -p "$dest"
    rsync -a --delete "$src/" "$dest/"
  fi
}

for target in "${TARGETS[@]}"; do
  mkdir -p "$target"
  for skill in "$REPO"/skills/*/; do
    name="$(basename "$skill")"
    [[ -f "$skill/SKILL.md" ]] || continue
    install_one "${skill%/}" "$target/$name"
  done
  if [[ $PRUNE -eq 1 ]]; then
    for entry in "$target"/*/; do
      entry="${entry%/}"
      if [[ -L "$entry" ]]; then
        real="$(readlink "$entry")"
        [[ "$real" == "$REPO/skills/"* && ! -d "$real" ]] && { rm "$entry"; echo "pruned $entry"; }
      fi
    done
  fi
  echo "installed $(ls -1 "$REPO/skills" | wc -l | tr -d ' ') skills into $target ($MODE)"
done

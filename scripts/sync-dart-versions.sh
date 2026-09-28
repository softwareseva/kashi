#!/usr/bin/env bash
# Bump every dart/kashi_* package to $1 (skipping any already at that version — e.g. a PR that
# shipped a real Flutter-side change already bumped it by hand, with its own CHANGELOG entry),
# commit and push that to main, then tag+push each bumped package via scripts/release-dart.sh
# to trigger .github/workflows/pub-release.yml.
#
# Run automatically by .github/workflows/release.yml right after `changeset publish`. Safe to
# run by hand too, from main, after an npm release: scripts/sync-dart-versions.sh 1.5.0
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: scripts/sync-dart-versions.sh <version>" >&2
  exit 2
fi

VERSION="$1"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES=(kashi_core kashi_auth kashi_list kashi_sync kashi_ui)
BUMPED=()

for PACKAGE in "${PACKAGES[@]}"; do
  PUBSPEC="$REPO/dart/$PACKAGE/pubspec.yaml"
  CHANGELOG="$REPO/dart/$PACKAGE/CHANGELOG.md"
  CURRENT="$(sed -n 's/^version: *//p' "$PUBSPEC" | head -1)"
  if [[ "$CURRENT" == "$VERSION" ]]; then
    echo "dart/$PACKAGE already at $VERSION (bumped by hand in this release), skipping"
    continue
  fi
  perl -pi -e "s/^version: .*/version: $VERSION/" "$PUBSPEC"
  { echo "## $VERSION"; echo; echo "- No functional changes; version bump to stay in lockstep with the npm packages."; echo; cat "$CHANGELOG"; } > "$CHANGELOG.new"
  mv "$CHANGELOG.new" "$CHANGELOG"
  BUMPED+=("$PACKAGE")
done

if [[ ${#BUMPED[@]} -eq 0 ]]; then
  echo "every dart/kashi_* package is already at $VERSION"
  exit 0
fi

git -C "$REPO" add dart
git -C "$REPO" commit -m "chore: bump dart/{$(IFS=,; echo "${BUMPED[*]}")} to $VERSION"
git -C "$REPO" push origin HEAD:main

for PACKAGE in "${BUMPED[@]}"; do
  "$REPO/scripts/release-dart.sh" "$PACKAGE"
done

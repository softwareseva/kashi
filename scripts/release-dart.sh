#!/usr/bin/env bash
# Tag and push a dart/ package release, triggering .github/workflows/pub-release.yml
# to publish it to pub.dev via OIDC trusted publishing.
#
#   scripts/release-dart.sh kashi_core
#
# Bump the package's pubspec.yaml version and CHANGELOG.md first, commit that,
# then run this script from main.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: scripts/release-dart.sh <package>" >&2
  exit 2
fi

PACKAGE="$1"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBSPEC="$REPO/dart/$PACKAGE/pubspec.yaml"

[[ -f "$PUBSPEC" ]] || { echo "no such package: dart/$PACKAGE" >&2; exit 1; }

VERSION="$(sed -n 's/^version: *//p' "$PUBSPEC" | head -1)"
[[ -n "$VERSION" ]] || { echo "could not read version from $PUBSPEC" >&2; exit 1; }

TAG="$PACKAGE-v$VERSION"

if git -C "$REPO" rev-parse "$TAG" >/dev/null 2>&1; then
  echo "tag $TAG already exists" >&2
  exit 1
fi

git -C "$REPO" tag "$TAG"
git -C "$REPO" push origin "$TAG"
echo "pushed $TAG - pub-release workflow will publish dart/$PACKAGE $VERSION to pub.dev"

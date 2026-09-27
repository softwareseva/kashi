# Contributing

- Open an issue or discussion before large changes.
- `pnpm install && pnpm run check` and `flutter pub get && flutter analyze dart` must pass.
- Published npm changes need `pnpm changeset`. Dart packages: bump `pubspec.yaml` version and `CHANGELOG.md`, then run `scripts/release-dart.sh <package>` to release to pub.dev.
- Skills follow the Agent Skills spec (https://agentskills.io/specification). `scripts/validate.sh` enforces it.
- Keep skill text generic: no company names, no personal paths.

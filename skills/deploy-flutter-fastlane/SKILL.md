---
name: deploy-flutter-fastlane
description: Ship a Flutter app to TestFlight, the App Store and Google Play with fastlane and GitHub Actions through the kashi CLI, covering match certificates in a private repo, an App Store Connect API key, Android upload keystore and key.properties signing, Play service account, build numbers, beta and release lanes, and every secret with where to create and store it. Use when setting up mobile CI/CD, uploading a build to TestFlight or Play, fixing iOS code signing or Android signing in CI, or rotating mobile release credentials.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/cli@0.1 fastlane@2.240"
---

# Ship a Flutter app with fastlane

```bash
npx @softwareseva/cli add deploy-fastlane --var APPLE_TEAM_ID=ABCDE12345
```

The CLI finds the Flutter project, reads the iOS bundle id and Android application id, and writes:

| File | Purpose |
|---|---|
| `<app>/Gemfile` | pins fastlane |
| `<app>/ios/fastlane/{Fastfile,Appfile,Matchfile}` | lanes `certificates`, `beta` (TestFlight), `release` (App Store Connect) |
| `<app>/ios/ExportOptions.plist` | manual signing with the match profile |
| `<app>/android/fastlane/{Fastfile,Appfile}` | lanes `beta` (internal track), `release` (promote to production, staged) |
| `<app>/android/key.properties.example` | local signing config shape |
| `.github/workflows/mobile-release.yml` | manual run or `mobile-v*` tag; iOS on macOS, Android on Ubuntu |

It adds `*.p8`, `*.jks`, `*.keystore`, `key.properties` and service-account JSON to `.gitignore` and prints every secret with how to create it (`npx @softwareseva/cli secrets` shows the list again).

## One-time setup

1. **Android signing**: add the `key.properties` block from `references/android-signing.md` to `android/app/build.gradle.kts`. Create the upload keystore with `keytool` (command in the next steps), keep it and its passwords in a password manager, never in git.
2. **iOS certificates**: create an empty private git repo for match, create an App Store Connect API key (App Manager), then on a Mac: `cd <app>/ios && bundle install && bundle exec fastlane certificates`. Choose a strong `MATCH_PASSWORD`.
3. **Store records**: create the app in App Store Connect and in Play Console. Upload the very first Android build by hand (Play requires it before API uploads).
4. **Play API access**: create a service account, download its JSON key, invite its email in Play Console with release permissions.
5. **GitHub secrets**: `gh secret set NAME` for each entry `npx @softwareseva/cli secrets` lists under deploy-fastlane; base64-encode binary files (`base64 -i file | pbcopy`).
6. Run the workflow manually with `lane: beta`, or push a tag `mobile-v1.0.0`.

`npx @softwareseva/cli doctor` confirms the gitignore covers the key files, no key file is tracked, and GitHub has every secret.

## How versions work

`pubspec.yaml` holds the marketing version (`1.4.0`). The build number is `BUILD_NUMBER` (the workflow passes `github.run_number`), or, when run locally, one more than the latest TestFlight or Play build. Bump the marketing version in `pubspec.yaml` for each store release.

## Rules

- Certificates live only in the encrypted match repo; CI runs match read-only.
- Never commit `.p8`, `.jks`, `key.properties` or service-account JSON. If one leaks: revoke the API key, rotate the Play key, and (for the upload keystore) request an upload key reset in Play Console.
- `release` lanes do not submit for review; submitting stays a human step in App Store Connect and a staged rollout on Play (`PLAY_ROLLOUT`, default 20%).
- Keep lanes in the repo so changes are reviewed; `npx @softwareseva/cli update` refreshes them when you have not edited them and writes `.kashi-new` files when you have.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No profiles for 'com.x' were found` | run `fastlane certificates` once; check `APPLE_TEAM_ID` and the bundle id in Appfile |
| match asks for a password in CI | `MATCH_PASSWORD` or `MATCH_GIT_BASIC_AUTHORIZATION` missing |
| `The bundle version must be higher` | the build number was already used; raise `BUILD_NUMBER` or let the lane compute it |
| Play: `APK specifies a version code that has already been used` | same as above for Android |
| Play: `The caller does not have permission` | the service account is not invited in Play Console, or lacks the track permission |
| Android build is debug-signed | `key.properties` block missing from `build.gradle.kts` |

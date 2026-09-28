# Generating secrets for deploy-fastlane

Step-by-step instructions for every secret in [`secrets.json`](secrets.json), needed by the fastlane lanes and GitHub Actions workflow this module installs to ship iOS to TestFlight/App Store and Android to Google Play.

All of these are GitHub repository secrets (`store: ci-secret` — set with `gh secret set NAME`); a few are also kept in the Mac keychain of whoever runs fastlane locally (`store: keychain`).

## iOS: App Store Connect API key

Used to authenticate `fastlane` with App Store Connect without a personal Apple ID/2FA prompt in CI.

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com/) → **Users and Access** → **Integrations** tab → **App Store Connect API** → **Team Keys** → the `+` button.
2. Name the key, set **Access**: **App Manager** (enough to upload builds; avoid Admin).
3. **Generate**. The key's **.p8 file downloads exactly once** — save it immediately; App Store Connect cannot re-issue it.
4. Note the **Key ID** and the **Issuer ID** shown above the keys list (the issuer id is shared by all your team's keys).

### APP_STORE_CONNECT_API_KEY_ID

The Key ID from step 4.

```bash
gh secret set APP_STORE_CONNECT_API_KEY_ID
```

### APP_STORE_CONNECT_ISSUER_ID

The Issuer ID from step 4 (same for every key on the team).

```bash
gh secret set APP_STORE_CONNECT_ISSUER_ID
```

### APP_STORE_CONNECT_API_KEY_CONTENT

The downloaded `.p8` file, base64-encoded so it survives as a single-line secret:

```bash
base64 -i AuthKey_XXXX.p8 | pbcopy
gh secret set APP_STORE_CONNECT_API_KEY_CONTENT
# paste, then Ctrl-D
```

Add `*.p8` to `.gitignore` immediately (the module's own gitignore additions cover this).

## iOS: code signing (fastlane match)

`match` stores your signing certificates and provisioning profiles encrypted in a private git repo, so every machine (and CI) uses the same identity instead of generating new certificates.

1. Create a new **empty, private** GitHub repository dedicated to this, e.g. `github.com/you/certificates`.
2. Choose a strong passphrase for encrypting that repo's contents — save it in a password manager, not in code.
3. On a Mac with your Apple Developer login available, run `bundle exec fastlane match init` (or `match appstore` the first time) pointing at that repo. This creates and encrypts the certificates/profiles.
4. For CI to read the repo, create a GitHub **fine-grained personal access token** scoped to read-only access on that one repository.

### MATCH_GIT_URL

The HTTPS URL of the private certificates repo from step 1, e.g. `https://github.com/you/certificates`.

```bash
gh secret set MATCH_GIT_URL
```

### MATCH_PASSWORD

The passphrase you chose in step 2.

```bash
gh secret set MATCH_PASSWORD
```

Rotate only by re-encrypting the whole repo: `bundle exec fastlane match change_password`, then update this secret to the new value everywhere it's stored.

### MATCH_GIT_BASIC_AUTHORIZATION

Base64 of `username:token` for the fine-grained token from step 4, so CI can clone the certificates repo without an interactive login:

```bash
printf 'your-github-username:ghp_yourFineGrainedToken' | base64 | pbcopy
gh secret set MATCH_GIT_BASIC_AUTHORIZATION
```

Rotate when the token expires (fine-grained tokens have a mandatory expiry date) — generate a new one and repeat the command above.

## Android: upload signing

Google Play requires every release to be signed by the same upload key. Create it once, before your first release; it cannot be swapped later without contacting Google.

1. Generate the keystore (do this once, keep the file forever):

   ```bash
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

   `keytool` prompts for a store password, your name/organisation, and a key password — remember what you type.
2. Enrol in **Play App Signing** (the default for new Play Console apps): Google holds the final app-signing key; this upload key only authenticates your uploads to Google, so losing it is recoverable (Play Console has a reset-upload-key flow) but still worth guarding.
3. See the `deploy-flutter-fastlane` skill's `references/android-signing.md` for the `build.gradle.kts` wiring that reads these values from `key.properties`.

### ANDROID_KEYSTORE_BASE64

The keystore file from step 1, base64-encoded:

```bash
base64 -i upload-keystore.jks | pbcopy
gh secret set ANDROID_KEYSTORE_BASE64
```

Add `*.jks`, `*.keystore`, and `key.properties` to `.gitignore` (the module's own gitignore additions cover this).

### ANDROID_KEYSTORE_PASSWORD

The store password you chose in step 1.

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD
```

### ANDROID_KEY_ALIAS

The `-alias` value from step 1 (the example above uses `upload`).

```bash
gh secret set ANDROID_KEY_ALIAS
```

### ANDROID_KEY_PASSWORD

The key password you chose in step 1 (`keytool` lets this differ from the store password, but many people set them the same).

```bash
gh secret set ANDROID_KEY_PASSWORD
```

## Android: Play Console upload

Lets CI upload builds to Google Play on your behalf via the Play Developer API.

1. [Google Cloud Console](https://console.cloud.google.com/) → **IAM & Admin** → **Service Accounts** → **Create Service Account** (any project linked to your Play Console works; a dedicated project is cleaner).
2. Open the new service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**. This downloads the JSON key file once.
3. In **Play Console** → **Users and permissions** → **Invite new users** → paste the service account's email address (looks like `name@project.iam.gserviceaccount.com`) → grant **Release to testing tracks** (and **Release to production** if this account should also promote releases).

### PLAY_SERVICE_ACCOUNT_JSON

The full contents of the downloaded JSON key file from step 2:

```bash
gh secret set PLAY_SERVICE_ACCOUNT_JSON < play-service-account.json
```

Add `play-service-account*.json` to `.gitignore` (the module's own gitignore additions cover this).

## See also

The `deploy-flutter-fastlane` skill for the full lane setup (beta/release lanes, build numbers, GitHub environment approvals).

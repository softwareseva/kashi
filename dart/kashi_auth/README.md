# kashi_auth

Flutter half of `@softwareseva/auth`. Depends only on `kashi_core` and `kashi_ui`; native plugins (Google, Apple, passkeys, biometrics) plug in through small adapters the app owns, so apps that use only one-time codes do not inherit other plugins' platform requirements.

```dart
KSignIn(
  google: googleIdToken,        // IdTokenSignIn, see the flutter-auth skill templates
  apple: appleIdToken,
  passkeys: PluginPasskeyBridge(),
)
```

- `KashiAuthApi`: config, OTP request/verify, password, Google/Apple ID tokens, passkey sign-in and registration, passkey list/rename/remove.
- `KSignIn`: Cupertino sign-in body that shows every provider the server enables and the app supplies an adapter for.
- `KPasskeySettings`: add, list and remove passkeys.
- `KBiometricGate`: locks the app after it has been in the background.

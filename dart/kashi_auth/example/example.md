# kashi_auth example

`KSignIn` shows every provider the server enables and the app supplies an
adapter for. Pass adapters only for the providers you've configured;
omit `google`/`apple`/`passkeys` to hide them.

```dart
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_core/kashi_core.dart';

void main() {
  runApp(
    ProviderScope(
      overrides: [
        kashiConfigProvider.overrideWithValue(
          const KashiConfig(baseUrl: 'https://api.example.com/v1'),
        ),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return CupertinoApp(
      home: switch (auth.status) {
        AuthStatus.signedIn => const HomeScreen(),
        _ => const CupertinoPageScaffold(
            child: KSignIn(title: 'Sign in to Acme'),
          ),
      },
    );
  }
}
```

Guard a screen behind biometrics with `KBiometricGate` (bring your own
`local_auth` call), and let users manage their passkeys with
`KPasskeySettings`:

```dart
KBiometricGate(
  reason: 'Unlock Acme',
  authenticate: (reason) => LocalAuthentication().authenticate(
    localizedReason: reason,
  ),
  child: const AccountScreen(),
);
```

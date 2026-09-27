# kashi_core example

Override `kashiConfigProvider` with your API's base URL, then use
`apiClientProvider` (a preconfigured [KashiApiClient]) and
`authControllerProvider` (session state) anywhere below it in the tree.

```dart
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
        _ => const CupertinoActivityIndicator(),
      },
    );
  }
}
```

Call the API directly for one-off requests:

```dart
final client = ref.read(apiClientProvider);
try {
  final page = await client.page<Map<String, dynamic>>(
    '/posts',
    const {},
    (json) => json,
  );
  print('fetched ${page.items.length} posts');
} on KashiFailure catch (failure) {
  print('request failed: ${failure.code} ${failure.message}');
}
```

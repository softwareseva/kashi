/// kashi example app: sign in with @softwareseva/auth, browse notes with kashi_list, biometric lock.
library;

import 'dart:io' show Platform;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_auth/kashi_auth.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_ui/kashi_ui.dart';

import 'adapters/biometric.dart';
import 'router.dart';

/// `--dart-define=API_URL=https://api.example.com/v1`. Defaults reach `wrangler dev` from simulators.
final _apiUrl = const String.fromEnvironment('API_URL').isNotEmpty
    ? const String.fromEnvironment('API_URL')
    : Platform.isAndroid
    ? 'http://10.0.2.2:8797/v1'
    : 'http://localhost:8797/v1';

void main() {
  runApp(
    ProviderScope(
      overrides: [
        kashiConfigProvider.overrideWithValue(
          KashiConfig(
            baseUrl: _apiUrl,
            deviceName: Platform.isIOS ? 'iPhone' : 'Android phone',
          ),
        ),
      ],
      child: const App(),
    ),
  );
}

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(
      authControllerProvider.select((s) => s.status == AuthStatus.signedIn),
    );
    return CupertinoApp.router(
      title: 'kashi example',
      theme: kashiCupertinoTheme(),
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => KBiometricGate(
        enabled: signedIn && const bool.fromEnvironment('BIOMETRIC_LOCK'),
        authenticate: biometricUnlock,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}

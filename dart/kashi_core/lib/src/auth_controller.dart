/// Riverpod session state for apps signing in with `@softwareseva/auth` over the token transport.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'failure.dart';
import 'models.dart';
import 'token_store.dart';

enum AuthStatus { unknown, signedOut, signedIn }

@immutable
class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.offline = false,
    this.busy = false,
    this.failure,
  });

  final AuthStatus status;
  final AuthUser? user;

  /// Signed in from the stored user because the server was unreachable at startup.
  final bool offline;
  final bool busy;
  final KashiFailure? failure;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? offline,
    bool? busy,
    KashiFailure? failure,
    bool clearFailure = false,
  }) => AuthState(
    status: status ?? this.status,
    user: user ?? this.user,
    offline: offline ?? this.offline,
    busy: busy ?? this.busy,
    failure: clearFailure ? null : (failure ?? this.failure),
  );
}

/// App configuration. Override in `ProviderScope(overrides: [kashiConfigProvider.overrideWithValue(...)])`.
@immutable
class KashiConfig {
  const KashiConfig({
    required this.baseUrl,
    this.authPath = '/auth',
    this.storageNamespace = 'kashi',
    this.deviceName,
  });
  final String baseUrl;
  final String authPath;
  final String storageNamespace;

  /// Shown in the user's session list, e.g. "Pixel 9".
  final String? deviceName;
}

final kashiConfigProvider = Provider<KashiConfig>(
  (ref) => throw UnimplementedError(
    'Override kashiConfigProvider in ProviderScope.',
  ),
);
final tokenStoreProvider = Provider<TokenStore>(
  (ref) =>
      TokenStore(namespace: ref.watch(kashiConfigProvider).storageNamespace),
);
final apiClientProvider = Provider<KashiApiClient>((ref) {
  final config = ref.watch(kashiConfigProvider);
  final client = KashiApiClient(
    baseUrl: config.baseUrl,
    authPath: config.authPath,
    tokens: ref.watch(tokenStoreProvider),
  );
  ref.onDispose(client.dispose);
  return client;
});

/// Callbacks to run on sign-in and sign-out, e.g. starting sync or wiping the local database.
final authLifecycleProvider = Provider<AuthLifecycle>(
  (ref) => const AuthLifecycle(),
);

@immutable
class AuthLifecycle {
  const AuthLifecycle({this.onSignedIn, this.onSignedOut});
  final FutureOr<void> Function(AuthUser user)? onSignedIn;
  final FutureOr<void> Function()? onSignedOut;
}

class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _expiry;

  KashiApiClient get _api => ref.read(apiClientProvider);
  TokenStore get _tokens => ref.read(tokenStoreProvider);
  KashiConfig get _config => ref.read(kashiConfigProvider);

  @override
  AuthState build() {
    _expiry = _api.sessionExpired.listen((_) => _signedOut());
    ref.onDispose(() => _expiry?.cancel());
    Future.microtask(restore);
    return const AuthState();
  }

  /// On launch: refresh with the stored token. Offline with a stored user means signed in (offline).
  Future<void> restore() async {
    final stored = await _tokens.read();
    if (stored.refreshToken == null) return _signedOut(notify: false);
    try {
      final session = await _api.refresh();
      await _enter(session.user);
    } on NetworkFailure {
      if (stored.user != null) {
        state = AuthState(
          status: AuthStatus.signedIn,
          user: stored.user,
          offline: true,
        );
        await ref.read(authLifecycleProvider).onSignedIn?.call(stored.user!);
      } else {
        _signedOut(notify: false);
      }
    } on KashiFailure {
      _signedOut(notify: false);
    }
  }

  /// Run any sign-in call that returns a token-transport session JSON and store the result.
  /// Returns the failure (also kept in state) so forms can show field errors.
  Future<KashiFailure?> signInWith(
    Future<Map<String, dynamic>> Function() call,
  ) async {
    state = state.copyWith(busy: true, clearFailure: true);
    try {
      final session = TokenSession.fromJson(await call());
      await _tokens.save(session);
      await _enter(session.user);
      return null;
    } on KashiFailure catch (f) {
      state = state.copyWith(busy: false, failure: f);
      return f;
    }
  }

  /// Body fields every token sign-in sends.
  Map<String, dynamic> get tokenBody => {
    'transport': 'token',
    if (_config.deviceName != null) 'deviceName': _config.deviceName,
  };

  Future<void> signOut() async {
    final refresh = await _tokens.readRefreshToken();
    if (refresh != null) {
      unawaited(
        _api
            .post<dynamic>(
              '${_config.authPath}/token/revoke',
              body: {'refreshToken': refresh},
              skipAuth: true,
            )
            .catchError((_) => null),
      );
    }
    await _tokens.clear();
    await _signedOut();
  }

  Future<void> reloadUser() async {
    final me = await _api.get<Map<String, dynamic>>('${_config.authPath}/me');
    state = state.copyWith(
      user: AuthUser.fromJson(me['user'] as Map<String, dynamic>),
    );
  }

  void clearFailure() => state = state.copyWith(clearFailure: true);

  Future<void> _enter(AuthUser user) async {
    state = AuthState(status: AuthStatus.signedIn, user: user);
    await ref.read(authLifecycleProvider).onSignedIn?.call(user);
  }

  Future<void> _signedOut({bool notify = true}) async {
    final wasSignedIn = state.status == AuthStatus.signedIn;
    state = const AuthState(status: AuthStatus.signedOut);
    if (notify && wasSignedIn) {
      await ref.read(authLifecycleProvider).onSignedOut?.call();
    }
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

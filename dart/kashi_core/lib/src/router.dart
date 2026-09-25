/// go_router integration: re-run redirects when auth changes and keep users on the right side of sign-in.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_controller.dart';

/// Pass as `GoRouter(refreshListenable: AuthRefreshListenable(ref))`.
class AuthRefreshListenable extends ChangeNotifier {
  AuthRefreshListenable(Ref ref) {
    ref.listen(
      authControllerProvider.select((s) => s.status),
      (_, _) => notifyListeners(),
    );
  }
}

/// Redirect for GoRouter. Signed-out users go to [signInPath] (remembering where they were);
/// signed-in users leave the sign-in screen for `from` or [homePath]. [publicPaths] are always allowed.
String? authRedirect(
  Ref ref,
  GoRouterState state, {
  String signInPath = '/sign-in',
  String homePath = '/',
  Set<String> publicPaths = const {},
  String? loadingPath,
}) {
  final status = ref.read(authControllerProvider).status;
  final location = state.matchedLocation;
  final atSignIn = location == signInPath;
  if (publicPaths.contains(location)) return null;
  switch (status) {
    case AuthStatus.unknown:
      return loadingPath != null && location != loadingPath
          ? loadingPath
          : null;
    case AuthStatus.signedOut:
      if (atSignIn) return null;
      return Uri(
        path: signInPath,
        queryParameters: location == homePath || location == loadingPath
            ? null
            : {'from': state.uri.toString()},
      ).toString();
    case AuthStatus.signedIn:
      if (atSignIn || location == loadingPath) {
        return state.uri.queryParameters['from'] ?? homePath;
      }
      return null;
  }
}

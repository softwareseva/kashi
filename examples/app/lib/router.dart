/// Routes with the kashi auth redirect.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kashi_core/kashi_core.dart';

import 'screens/notes_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/sign_in_screen.dart';

final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    initialLocation: '/loading',
    refreshListenable: AuthRefreshListenable(ref),
    redirect: (context, state) => authRedirect(
      ref,
      state,
      signInPath: '/sign-in',
      homePath: '/',
      loadingPath: '/loading',
    ),
    routes: [
      GoRoute(
        path: '/loading',
        builder: (_, _) => const CupertinoPageScaffold(
          child: Center(child: CupertinoActivityIndicator()),
        ),
      ),
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/', builder: (_, _) => const NotesScreen()),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
    ],
  ),
);

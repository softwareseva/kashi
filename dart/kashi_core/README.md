# kashi_core

Flutter client foundation for APIs built with `@kashi/core` and `@kashi/auth`.

- `KashiApiClient`: Dio with the bearer token attached, one shared refresh for concurrent 401s, and every response unwrapped from `{ data }` or thrown as a typed `KashiFailure` (`ApiFailure` with `code`, `fields`, `requestId`; `NetworkFailure`; `SessionExpiredFailure`).
- `TokenStore`: rotating refresh token and last user in the keychain (`first_unlock` on iOS); access token in memory.
- `AuthController` (Riverpod): restores the session on launch, stays signed in offline with the stored user, signs out when refresh fails.
- `authRedirect` + `AuthRefreshListenable` for go_router.
- `KPage<T>` for `@kashi/list` keyset pages; `newId()` matching the server.

```dart
ProviderScope(
  overrides: [kashiConfigProvider.overrideWithValue(const KashiConfig(baseUrl: 'https://api.example.com/v1'))],
  child: const App(),
);
```

See the `flutter-api-client` and `flutter-auth` skills.

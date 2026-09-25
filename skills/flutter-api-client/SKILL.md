---
name: flutter-api-client
description: Call a kashi (Hono + D1) API from Flutter with kashi_core, covering the KashiApiClient on Dio, typed KashiFailure errors, envelope unwrapping, single-flight token refresh, secure session storage, Riverpod providers, base URLs for simulators and devices, and keyset pages with KPage. Use when setting up networking in a Flutter app, adding a repository or API call, handling API or offline errors in the UI, or debugging 401 and refresh loops.
license: MIT
metadata:
  version: "0.1.0"
  packages: "kashi_core@0.1"
---

# Flutter API client

## Setup

```yaml
dependencies:
  kashi_core: ^0.1.0
  flutter_riverpod: ^3.4.3
```

```dart
void main() => runApp(ProviderScope(
  overrides: [kashiConfigProvider.overrideWithValue(KashiConfig(baseUrl: apiUrl, deviceName: 'iPhone'))],
  child: const App(),
));
```

`apiUrl` comes from `--dart-define=API_URL=https://api.example.com/v1`. Local development defaults (`templates/config.dart`): iOS Simulator `http://localhost:8787/v1`, Android emulator `http://10.0.2.2:8787/v1`. For plain HTTP locally add `NSAllowsLocalNetworking` to iOS `Info.plist` and `android:usesCleartextTraffic="true"` to the Android debug manifest only.

## Calling the API

```dart
final api = ref.read(apiClientProvider);
final note = Note.fromJson(await api.get<Map<String, dynamic>>('/notes/$id'));
await api.post<Map<String, dynamic>>('/notes', body: {'title': title});
final page = await api.page('/notes', {'q': q, 'sort': 'updatedAt', 'direction': 'desc', 'limit': 25}, Note.fromJson);
```

Calls return the unwrapped `data` or throw a `KashiFailure`:

| Failure | Meaning | UI |
|---|---|---|
| `ApiFailure(code, message, status, fields, requestId)` | the server rejected the request | `failure.field('title')` into `KTextField(errorText:)`, otherwise `KAlert(title: failure.message)` |
| `NetworkFailure` | offline, DNS, timeout | show cached data and a retry |
| `SessionExpiredFailure` | refresh failed; the auth controller signs out | nothing; the router moves to sign-in |
| `UnexpectedFailure` | response was not an envelope | log `requestId`-less report |

Branch on `code`, never on message text.

## Repositories

Keep calls in one class per resource and expose them through a provider (`templates/notes_repository.dart`). Screens use repositories or `KDirectoryController`, never Dio.

## Tokens and refresh

- The access token lives in memory; the rotating refresh token and last user are in the keychain (`first_unlock` on iOS so background work can read them after a reboot).
- On a 401 the client calls `POST /auth/token/refresh` once, even when several requests fail together, then retries each with the new token. Presenting the same refresh token twice would make the server revoke the whole session family, which is why the refresh is shared.
- If refresh fails the client clears storage and emits `sessionExpired`; `AuthController` signs out.

## Tests

Swap the transport, not the client: `client.dio.httpClientAdapter = FakeAdapter(...)` and a `FlutterSecureStorage` subclass backed by a map (`templates/test_helpers.dart`). Override `tokenStoreProvider` and `apiClientProvider` in a `ProviderContainer`.

/// Session persistence in the platform keychain / keystore.
library;

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// The access token lives in memory only; the rotating refresh token and the last known user
/// are persisted so the app can restore a session (or run offline) after a restart.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage, String namespace = 'kashi'})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            // Readable after the first unlock following a reboot, so background sync works.
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock,
            ),
          ),
      _refreshKey = '$namespace.refresh_token',
      _userKey = '$namespace.user';

  final FlutterSecureStorage _storage;
  final String _refreshKey;
  final String _userKey;

  String? accessToken;

  /// One keychain round trip for both values.
  Future<({String? refreshToken, AuthUser? user})> read() async {
    final all = await _storage.readAll();
    AuthUser? user;
    final raw = all[_userKey];
    if (raw != null) {
      try {
        user = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } on FormatException {
        user = null;
      }
    }
    return (refreshToken: all[_refreshKey], user: user);
  }

  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  Future<void> save(TokenSession session) async {
    accessToken = session.accessToken;
    await _storage.write(key: _refreshKey, value: session.refreshToken);
    await _storage.write(
      key: _userKey,
      value: jsonEncode(session.user.toJson()),
    );
  }

  Future<void> clear() async {
    accessToken = null;
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userKey);
  }
}

/// Seams for native sign-in plugins. Implementations live in the app (see the flutter-auth skill),
/// so this package pulls in no platform plugins and their minimum-OS requirements.
library;

import 'package:flutter/foundation.dart';

/// Result of a native OAuth sign-in (Google, Apple). `name` is only sent by Apple on first sign-in.
@immutable
class IdTokenResult {
  const IdTokenResult(this.idToken, {this.name});
  final String idToken;
  final String? name;
}

/// Runs the platform sign-in sheet. Return null when the user cancels; throw on real errors.
typedef IdTokenSignIn = Future<IdTokenResult?> Function();

/// Result of a native Facebook Login (the SDK returns an access token, not an ID token).
@immutable
class AccessTokenResult {
  const AccessTokenResult(this.accessToken);
  final String accessToken;
}

/// Runs the Facebook Login sheet. Return null when the user cancels; throw on real errors.
typedef AccessTokenSignIn = Future<AccessTokenResult?> Function();

/// Bridges WebAuthn JSON between the server and a platform passkey plugin.
abstract interface class PasskeyBridge {
  /// `options` is PublicKeyCredentialRequestOptionsJSON; return AuthenticationResponseJSON.
  Future<Map<String, dynamic>> authenticate(Map<String, dynamic> options);

  /// `options` is PublicKeyCredentialCreationOptionsJSON; return RegistrationResponseJSON.
  Future<Map<String, dynamic>> register(Map<String, dynamic> options);
}

/// Thrown by adapters when the user dismissed the system sheet; the UI stays quiet.
class SignInCancelled implements Exception {
  const SignInCancelled();
}

/// Runs a peer kashi site's sign-in page in a system browser (e.g. `flutter_web_auth_2` or
/// `ASWebAuthenticationSession`/Custom Tabs directly) and returns the final redirect URL once the
/// site completes it. `kashi_auth` pulls in no browser/webview plugin, same as it pulls in no
/// Google/Apple/Facebook SDK — the host app supplies this bridge. Return null when the user
/// dismisses the browser; throw on real errors.
typedef PeerBrowserSignIn = Future<Uri?> Function(
  Uri authorizeUrl,
  Uri redirectPrefix,
);

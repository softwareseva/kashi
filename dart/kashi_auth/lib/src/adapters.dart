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

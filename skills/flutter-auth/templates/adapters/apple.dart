/// Sign in with Apple adapter (sign_in_with_apple 8): identity token plus the name Apple sends on first sign-in.
library;

import 'package:kashi_auth/kashi_auth.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

Future<IdTokenResult?> appleIdToken() async {
  try {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final token = credential.identityToken;
    if (token == null) {
      throw StateError('Apple did not return an identity token.');
    }
    final name = [
      credential.givenName,
      credential.familyName,
    ].whereType<String>().join(' ').trim();
    return IdTokenResult(token, name: name.isEmpty ? null : name);
  } on SignInWithAppleAuthorizationException catch (e) {
    if (e.code == AuthorizationErrorCode.canceled) return null;
    rethrow;
  }
}

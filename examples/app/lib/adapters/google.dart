/// Google sign-in adapter (google_sign_in 7): returns an ID token whose audience is the web client id.
library;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:kashi_auth/kashi_auth.dart';

/// Pass `--dart-define=GOOGLE_SERVER_CLIENT_ID=<web client id>`; the same id is GOOGLE_CLIENT_ID on the server.
const _serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
Future<void>? _init;

Future<IdTokenResult?> googleIdToken() async {
  _init ??= GoogleSignIn.instance.initialize(
    serverClientId: _serverClientId.isEmpty ? null : _serverClientId,
  );
  await _init;
  try {
    final account = await GoogleSignIn.instance.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw StateError(
        'Google did not return an ID token. Check serverClientId.',
      );
    }
    return IdTokenResult(idToken);
  } on GoogleSignInException catch (e) {
    if (e.code == GoogleSignInExceptionCode.canceled) return null;
    rethrow;
  }
}

Future<void> googleSignOut() async {
  _init ??= GoogleSignIn.instance.initialize(
    serverClientId: _serverClientId.isEmpty ? null : _serverClientId,
  );
  await _init;
  await GoogleSignIn.instance.signOut();
}

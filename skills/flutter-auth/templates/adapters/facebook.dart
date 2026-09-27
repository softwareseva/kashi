/// Facebook Login adapter (flutter_facebook_auth): returns an access token, not an ID token —
/// the server verifies it against the Graph API's debug_token endpoint.
library;

import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:kashi_auth/kashi_auth.dart';

Future<AccessTokenResult?> facebookAccessToken() async {
  final result = await FacebookAuth.instance.login(
    permissions: const ['email', 'public_profile'],
  );
  switch (result.status) {
    case LoginStatus.success:
      return AccessTokenResult(result.accessToken!.tokenString);
    case LoginStatus.cancelled:
      return null;
    case LoginStatus.failed:
    case LoginStatus.operationInProgress:
      throw StateError(result.message ?? 'Facebook sign-in failed.');
  }
}

Future<void> facebookSignOut() => FacebookAuth.instance.logOut();

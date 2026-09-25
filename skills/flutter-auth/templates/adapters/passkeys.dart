/// Passkey bridge on the `passkeys` plugin. Needs associated domains (iOS) and assetlinks.json (Android) for RP_ID.
library;

import 'package:kashi_auth/kashi_auth.dart';
import 'package:passkeys/authenticator.dart';
import 'package:passkeys/types.dart';

class PluginPasskeyBridge implements PasskeyBridge {
  PluginPasskeyBridge({PasskeyAuthenticator? authenticator})
    : _authenticator = authenticator ?? PasskeyAuthenticator();
  final PasskeyAuthenticator _authenticator;

  @override
  Future<Map<String, dynamic>> authenticate(
    Map<String, dynamic> options,
  ) async {
    try {
      final request = AuthenticateRequestType.fromJson(
        options,
        mediation: MediationType.Optional,
        preferImmediatelyAvailableCredentials: false,
      );
      return (await _authenticator.authenticate(request)).toJson();
    } on PasskeyAuthCancelledException {
      throw const SignInCancelled();
    }
  }

  @override
  Future<Map<String, dynamic>> register(Map<String, dynamic> options) async {
    try {
      return (await _authenticator.register(
        RegisterRequestType.fromJson(options),
      )).toJson();
    } on PasskeyAuthCancelledException {
      throw const SignInCancelled();
    }
  }
}

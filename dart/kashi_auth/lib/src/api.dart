/// Calls to the `@softwareseva/auth` router with the token transport.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';

/// A trusted peer kashi site this app can sign in through ("Continue with {label}").
@immutable
class PeerConfig {
  const PeerConfig({required this.key, required this.label});
  factory PeerConfig.fromJson(Map<String, dynamic> j) =>
      PeerConfig(key: j['key'] as String, label: j['label'] as String);
  final String key;
  final String label;
}

@immutable
class AuthProviders {
  const AuthProviders({
    this.password = false,
    this.otpChannel,
    this.google = false,
    this.apple = false,
    this.facebook = false,
    this.passkeys = false,
    this.passkeySignUp = false,
    this.peers = const [],
  });

  factory AuthProviders.fromJson(Map<String, dynamic> json) {
    final p = json['providers'] as Map<String, dynamic>;
    final otp = p['otp'] as Map<String, dynamic>?;
    return AuthProviders(
      password: p['password'] == true,
      otpChannel: otp?['channel'] as String?,
      google: p['google'] == true,
      apple: p['apple'] == true,
      facebook: p['facebook'] == true,
      passkeys: p['passkeys'] == true,
      passkeySignUp: p['passkeySignUp'] == true,
      peers:
          (p['peer'] as List?)
              ?.cast<Map<String, dynamic>>()
              .map(PeerConfig.fromJson)
              .toList() ??
          const [],
    );
  }

  final bool password;

  /// `phone`, `email`, or null when OTP is off.
  final String? otpChannel;
  final bool google;
  final bool apple;
  final bool facebook;
  final bool passkeys;

  /// Contact-free account creation from a brand-new passkey (`/passkeys/signup/*`).
  final bool passkeySignUp;

  /// Other kashi sites whose accounts this site accepts sign-in from.
  final List<PeerConfig> peers;
}

@immutable
class PasskeyItem {
  const PasskeyItem({
    required this.id,
    required this.deviceName,
    required this.backedUp,
    required this.createdAt,
    this.rpId,
    this.lastUsedAt,
  });
  factory PasskeyItem.fromJson(Map<String, dynamic> j) => PasskeyItem(
    id: j['id'] as String,
    deviceName: j['deviceName'] as String,
    backedUp: j['backedUp'] == true,
    rpId: j['rpId'] as String?,
    createdAt: j['createdAt'] as String,
    lastUsedAt: j['lastUsedAt'] as String?,
  );
  final String id;
  final String deviceName;
  final bool backedUp;

  /// The domain this passkey was created for (WebAuthn RP ID), for display on a settings screen.
  final String? rpId;
  final String createdAt;
  final String? lastUsedAt;
}

class KashiAuthApi {
  KashiAuthApi(this.client, {this.authPath = '/auth', this.deviceName});

  final KashiApiClient client;
  final String authPath;
  final String? deviceName;

  Map<String, dynamic> get _token => {
    'transport': 'token',
    if (deviceName != null) 'deviceName': deviceName,
  };

  Future<AuthProviders> config() async => AuthProviders.fromJson(
    await client.get<Map<String, dynamic>>('$authPath/config'),
  );

  Future<void> requestOtp(String destination) => client.post<dynamic>(
    '$authPath/otp/request',
    body: {'destination': destination},
  );
  Future<Map<String, dynamic>> verifyOtp(
    String destination,
    String code, {
    String? name,
  }) => client.post<Map<String, dynamic>>(
    '$authPath/otp/verify',
    body: {
      'destination': destination,
      'code': code,
      if (name != null && name.isNotEmpty) 'name': name,
      ..._token,
    },
  );

  Future<Map<String, dynamic>> passwordSignIn(
    String identifier,
    String password,
  ) => client.post<Map<String, dynamic>>(
    '$authPath/password/sign-in',
    body: {'identifier': identifier, 'password': password, ..._token},
  );

  Future<Map<String, dynamic>> google(String idToken) =>
      client.post<Map<String, dynamic>>(
        '$authPath/google/token',
        body: {'idToken': idToken, ..._token},
      );
  Future<Map<String, dynamic>> apple(String idToken, {String? name}) =>
      client.post<Map<String, dynamic>>(
        '$authPath/apple/token',
        body: {
          'idToken': idToken,
          if (name != null && name.isNotEmpty) 'name': name,
          ..._token,
        },
      );
  Future<Map<String, dynamic>> facebook(String accessToken) =>
      client.post<Map<String, dynamic>>(
        '$authPath/facebook/token',
        body: {'accessToken': accessToken, ..._token},
      );

  /// The URL that starts sign-in with a trusted peer kashi site (`peerKey` from [PeerConfig.key]).
  /// Open it in a system browser via a [PeerBrowserSignIn] adapter; [redirectPrefix] is what that
  /// browser should watch for, since the peer redirects back to this app's own `/peer/callback`.
  Uri peerAuthorizeUrl(String peerKey, {String next = '/'}) {
    final base = Uri.parse(client.baseUrl);
    return base.replace(
      path: '${base.path}$authPath/peer/$peerKey/start',
      queryParameters: {'next': next},
    );
  }

  Uri peerRedirectPrefix() {
    final base = Uri.parse(client.baseUrl);
    return base.replace(path: '${base.path}$authPath/peer/callback');
  }

  /// Completes peer sign-in with the `code` pulled off the redirect URL the browser returned.
  /// The client secret for `peerKey` lives only on this app's own backend, never in the app.
  Future<Map<String, dynamic>> peerToken(String peerKey, String code) =>
      client.post<Map<String, dynamic>>(
        '$authPath/peer/token',
        body: {'key': peerKey, 'code': code, ..._token},
      );

  Future<({Map<String, dynamic> options, String challengeId})>
  passkeyOptions() async {
    final r = await client.post<Map<String, dynamic>>(
      '$authPath/passkeys/authenticate/options',
      body: const {},
    );
    return (
      options: r['options'] as Map<String, dynamic>,
      challengeId: r['challengeId'] as String,
    );
  }

  Future<Map<String, dynamic>> passkeyVerify(
    String challengeId,
    Map<String, dynamic> response,
  ) => client.post<Map<String, dynamic>>(
    '$authPath/passkeys/authenticate/verify',
    body: {'challengeId': challengeId, 'response': response, ..._token},
  );

  Future<({Map<String, dynamic> options, String challengeId})>
  passkeyRegisterOptions() async {
    final r = await client.post<Map<String, dynamic>>(
      '$authPath/passkeys/register/options',
      body: const {},
    );
    return (
      options: r['options'] as Map<String, dynamic>,
      challengeId: r['challengeId'] as String,
    );
  }

  Future<void> passkeyRegisterVerify(
    String challengeId,
    Map<String, dynamic> response,
    String deviceName,
  ) => client.post<dynamic>(
    '$authPath/passkeys/register/verify',
    body: {
      'challengeId': challengeId,
      'response': response,
      'deviceName': deviceName,
    },
  );

  /// Contact-free sign-up: no auth, no email/phone/OAuth. The account is created only once
  /// [passkeySignUpVerify] confirms the new passkey.
  Future<({Map<String, dynamic> options, String challengeId})>
  passkeySignUpOptions() async {
    final r = await client.post<Map<String, dynamic>>(
      '$authPath/passkeys/signup/options',
      body: const {},
    );
    return (
      options: r['options'] as Map<String, dynamic>,
      challengeId: r['challengeId'] as String,
    );
  }

  Future<Map<String, dynamic>> passkeySignUpVerify(
    String challengeId,
    Map<String, dynamic> response,
    String deviceName, {
    String? name,
  }) => client.post<Map<String, dynamic>>(
    '$authPath/passkeys/signup/verify',
    body: {
      'challengeId': challengeId,
      'response': response,
      'deviceName': deviceName,
      if (name != null && name.isNotEmpty) 'name': name,
      ..._token,
    },
  );

  Future<List<PasskeyItem>> passkeys() async =>
      ((await client.get<Map<String, dynamic>>('$authPath/passkeys'))['items']
              as List)
          .cast<Map<String, dynamic>>()
          .map(PasskeyItem.fromJson)
          .toList();
  Future<void> renamePasskey(String id, String deviceName) =>
      client.patch<dynamic>(
        '$authPath/passkeys/$id',
        body: {'deviceName': deviceName},
      );
  Future<void> removePasskey(String id) =>
      client.delete<dynamic>('$authPath/passkeys/$id');
}

final kashiAuthApiProvider = Provider<KashiAuthApi>((ref) {
  final config = ref.watch(kashiConfigProvider);
  return KashiAuthApi(
    ref.watch(apiClientProvider),
    authPath: config.authPath,
    deviceName: config.deviceName,
  );
});

final authProvidersProvider = FutureProvider<AuthProviders>(
  (ref) => ref.watch(kashiAuthApiProvider).config(),
);

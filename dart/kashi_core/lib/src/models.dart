/// Shared models: the signed-in user and a session response from `@softwareseva/auth`.
library;

import 'package:flutter/foundation.dart';

@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.roles = const [],
    this.emailVerifiedAt,
    this.phoneVerifiedAt,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String,
    name: json['name'] as String? ?? '',
    email: json['email'] as String?,
    phone: json['phone'] as String?,
    roles: (json['roles'] as List?)?.cast<String>() ?? const [],
    emailVerifiedAt: json['emailVerifiedAt'] as String?,
    phoneVerifiedAt: json['phoneVerifiedAt'] as String?,
  );

  final String id;
  final String name;
  final String? email;
  final String? phone;
  final List<String> roles;
  final String? emailVerifiedAt;
  final String? phoneVerifiedAt;

  bool hasRole(String role) => roles.contains(role);

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'roles': roles,
    'emailVerifiedAt': emailVerifiedAt,
    'phoneVerifiedAt': phoneVerifiedAt,
  };

  @override
  bool operator ==(Object other) =>
      other is AuthUser &&
      other.id == id &&
      other.name == name &&
      listEquals(other.roles, roles);

  @override
  int get hashCode => Object.hash(id, name, Object.hashAll(roles));
}

/// Body of every token-transport sign-in and refresh response.
@immutable
class TokenSession {
  const TokenSession({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory TokenSession.fromJson(Map<String, dynamic> json) => TokenSession(
    user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 900,
  );

  final AuthUser user;
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
}

/// Keyset page from `@softwareseva/list`: `{ items, next, previous }`.
@immutable
class KPage<T> {
  const KPage({required this.items, this.next, this.previous});

  factory KPage.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) item,
  ) => KPage(
    items: (json['items'] as List)
        .cast<Map<String, dynamic>>()
        .map(item)
        .toList(growable: false),
    next: json['next'] as String?,
    previous: json['previous'] as String?,
  );

  final List<T> items;
  final String? next;
  final String? previous;
}

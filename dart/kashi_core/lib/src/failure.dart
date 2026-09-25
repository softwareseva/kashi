/// Typed errors for every kashi API call. Screens branch on these, never on Dio exceptions.
library;

/// Base type. `code` matches the server's `code` field (UPPER_SNAKE).
sealed class KashiFailure implements Exception {
  const KashiFailure(this.code, this.message);

  final String code;

  /// Safe to show to the user.
  final String message;

  @override
  String toString() => '$runtimeType($code): $message';
}

/// The server answered with the `{ code, message, requestId, fields? }` envelope.
class ApiFailure extends KashiFailure {
  const ApiFailure(
    super.code,
    super.message, {
    required this.status,
    this.fields = const {},
    this.requestId,
  });

  final int status;

  /// Field name to messages, for form errors (`VALIDATION_ERROR`).
  final Map<String, List<String>> fields;
  final String? requestId;

  /// First message for a field, for `KTextField(errorText: ...)`.
  String? field(String name) => fields[name]?.firstOrNull;

  bool get isUnauthorized => status == 401;
  bool get isRateLimited => code == 'RATE_LIMITED';
}

/// No usable response: offline, DNS, TLS, timeout. Offline-capable screens fall back to local data.
class NetworkFailure extends KashiFailure {
  const NetworkFailure([
    String message = 'Could not reach the server. Check your connection.',
  ]) : super('NETWORK', message);
}

/// The session ended (refresh failed or was revoked). The auth controller signs the user out.
class SessionExpiredFailure extends KashiFailure {
  const SessionExpiredFailure()
    : super('SESSION_EXPIRED', 'Your session has ended. Please sign in again.');
}

/// A response that did not match the envelope. Indicates a server or proxy bug.
class UnexpectedFailure extends KashiFailure {
  const UnexpectedFailure([String message = 'Something went wrong.'])
    : super('UNEXPECTED', message);
}

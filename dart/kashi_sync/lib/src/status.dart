/// What the sync engine is doing, for a status badge or settings row.
library;

import 'package:flutter/foundation.dart';

enum SyncPhase { idle, syncing, offline, failed }

@immutable
class SyncStatus {
  const SyncStatus({
    this.phase = SyncPhase.idle,
    this.pending = 0,
    this.needsAttention = 0,
    this.lastSyncAt,
    this.message,
  });

  final SyncPhase phase;

  /// Local changes waiting to be pushed.
  final int pending;

  /// Changes the server rejected permanently or that exhausted retries; show them to the user.
  final int needsAttention;
  final DateTime? lastSyncAt;
  final String? message;

  SyncStatus copyWith({
    SyncPhase? phase,
    int? pending,
    int? needsAttention,
    DateTime? lastSyncAt,
    String? message,
    bool clearMessage = false,
  }) => SyncStatus(
    phase: phase ?? this.phase,
    pending: pending ?? this.pending,
    needsAttention: needsAttention ?? this.needsAttention,
    lastSyncAt: lastSyncAt ?? this.lastSyncAt,
    message: clearMessage ? null : (message ?? this.message),
  );
}

@immutable
class OutboxEntry {
  const OutboxEntry({
    required this.opId,
    required this.type,
    required this.entity,
    required this.entityId,
    required this.payload,
    required this.attempts,
    this.lastError,
  });
  final String opId;
  final String type;
  final String entity;
  final String entityId;
  final Map<String, dynamic> payload;
  final int attempts;
  final String? lastError;
}

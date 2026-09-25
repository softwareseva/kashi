/// Small sync status badge for a navigation bar.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_sync/kashi_sync.dart';
import 'package:kashi_ui/kashi_ui.dart';

import 'sync.dart';

class SyncBadge extends ConsumerWidget {
  const SyncBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(syncStatusProvider).value;
    if (s == null) return const SizedBox.shrink();
    final (label, variant) = switch (s.phase) {
      SyncPhase.syncing => ('Syncing', KBadgeVariant.neutral),
      SyncPhase.offline => (s.pending > 0 ? '${s.pending} waiting' : 'Offline', KBadgeVariant.neutral),
      SyncPhase.failed => ('Sync failed', KBadgeVariant.danger),
      SyncPhase.idle when s.needsAttention > 0 => ('${s.needsAttention} need attention', KBadgeVariant.danger),
      SyncPhase.idle => (s.pending > 0 ? '${s.pending} waiting' : 'Up to date', KBadgeVariant.success),
    };
    return GestureDetector(onTap: () => ref.read(syncEngineProvider).sync(), child: KBadge(label, variant: variant));
  }
}

/// Local-first notes: read from Drift, write through the outbox, sync status in the nav bar.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_sync/kashi_sync.dart';
import 'package:kashi_ui/kashi_ui.dart';

import '../data/database.dart';
import '../data/sync.dart';

final _notesStream = StreamProvider<List<LocalNote>>(
  (ref) => ref.watch(localNotesProvider).watchAll(),
);

class OfflineNotesScreen extends ConsumerWidget {
  const OfflineNotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = KColors.of(context);
    final notes = ref.watch(_notesStream).value ?? const [];
    final status = ref.watch(syncStatusProvider).value;
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('Offline notes'),
        trailing: status == null
            ? null
            : KBadge(
                _label(status),
                variant: status.phase == SyncPhase.failed
                    ? KBadgeVariant.danger
                    : KBadgeVariant.neutral,
              ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(KSpace.s4),
              child: KButton(
                label: 'Add note',
                icon: KIcons.add,
                expand: true,
                onPressed: () => ref
                    .read(localNotesProvider)
                    .save(
                      title:
                          'Note ${DateTime.now().toLocal().toIso8601String().substring(11, 19)}',
                    ),
              ),
            ),
            Expanded(
              child: CustomScrollView(
                slivers: [
                  CupertinoSliverRefreshControl(
                    onRefresh: () => ref.read(syncEngineProvider).sync(),
                  ),
                  SliverList.builder(
                    itemCount: notes.length,
                    itemBuilder: (context, i) => Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: KSpace.s4,
                        vertical: 12,
                      ),
                      child: Text(
                        notes[i].title,
                        style: KText.body.copyWith(color: c.ink),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _label(SyncStatus s) => switch (s.phase) {
  SyncPhase.syncing => 'Syncing',
  SyncPhase.offline => s.pending > 0 ? '${s.pending} waiting' : 'Offline',
  SyncPhase.failed => 'Sync failed',
  SyncPhase.idle =>
    s.needsAttention > 0
        ? '${s.needsAttention} need attention'
        : (s.pending > 0 ? '${s.pending} waiting' : 'Up to date'),
};

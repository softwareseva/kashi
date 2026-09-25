/// Notes list on KDataList: search, sort sheet, pull-to-refresh, infinite scroll.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kashi_list/kashi_list.dart';
import 'package:kashi_ui/kashi_ui.dart';

import '../notes.dart';

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = KColors.of(context);
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('Notes'),
        trailing: KIconButton(
          icon: KIcons.settings,
          label: 'Settings',
          small: true,
          onPressed: () => context.push('/settings'),
        ),
      ),
      child: SafeArea(
        child: KDataList<Note>(
          controller: ref.watch(notesDirectoryProvider),
          searchPlaceholder: 'Search notes',
          sortOptions: const {'updatedAt': 'Last updated', 'title': 'Title'},
          emptyTitle: 'No notes yet',
          itemBuilder: (context, n) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                n.title,
                style: KText.body.copyWith(
                  color: c.ink,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _date(n.updatedAt),
                style: KText.bodySm.copyWith(color: c.inkMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _date(DateTime d) {
  final l = d.toLocal();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${l.day} ${months[l.month - 1]} ${l.year}, ${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

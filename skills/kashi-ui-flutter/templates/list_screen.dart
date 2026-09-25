/// A list screen over a kashi keyset endpoint: KDataList + KDirectoryController.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_list/kashi_list.dart';
import 'package:kashi_ui/kashi_ui.dart';

class Note {
  const Note({required this.id, required this.title, required this.updatedAt});
  factory Note.fromJson(Map<String, dynamic> j) => Note(
    id: j['id'] as String,
    title: j['title'] as String,
    updatedAt: DateTime.parse(j['updatedAt'] as String),
  );
  final String id;
  final String title;
  final DateTime updatedAt;
}

final notesDirectoryProvider = Provider.autoDispose<KDirectoryController<Note>>(
  (ref) {
    final api = ref.watch(apiClientProvider);
    final controller = KDirectoryController<Note>(
      fetch: (q) => api.page('/notes', q, Note.fromJson),
      sort: 'updatedAt',
      direction: KSortDirection.desc,
    );
    ref.onDispose(controller.dispose);
    return controller;
  },
);

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = KColors.of(context);
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Notes')),
      child: SafeArea(
        child: KDataList<Note>(
          controller: ref.watch(notesDirectoryProvider),
          searchPlaceholder: 'Search notes',
          sortOptions: const {'updatedAt': 'Last updated', 'title': 'Title'},
          emptyTitle: 'No notes yet',
          onTap: (n) => context.push('/notes/${n.id}'),
          itemBuilder: (context, n) =>
              Text(n.title, style: KText.body.copyWith(color: c.ink)),
        ),
      ),
    );
  }
}

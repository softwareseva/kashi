/// Notes model and list controller for the example API.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_list/kashi_list.dart';

class Note {
  const Note({
    required this.id,
    required this.title,
    required this.body,
    required this.updatedAt,
  });
  factory Note.fromJson(Map<String, dynamic> j) => Note(
    id: j['id'] as String,
    title: j['title'] as String,
    body: j['body'] as String? ?? '',
    updatedAt: DateTime.parse(j['updatedAt'] as String),
  );
  final String id;
  final String title;
  final String body;
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

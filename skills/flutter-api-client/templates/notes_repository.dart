/// One repository per resource. Screens call these, never Dio.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kashi_core/kashi_core.dart';

class Note {
  const Note({required this.id, required this.title, required this.body});
  factory Note.fromJson(Map<String, dynamic> j) => Note(
    id: j['id'] as String,
    title: j['title'] as String,
    body: j['body'] as String? ?? '',
  );
  final String id;
  final String title;
  final String body;
}

class NotesRepository {
  NotesRepository(this._api);
  final KashiApiClient _api;

  Future<Note> get(String id) async =>
      Note.fromJson(await _api.get<Map<String, dynamic>>('/notes/$id'));
  Future<Note> create(String title, {String body = ''}) async => Note.fromJson(
    await _api.post<Map<String, dynamic>>(
      '/notes',
      body: {'title': title, 'body': body},
    ),
  );
  Future<KPage<Note>> list(Map<String, dynamic> query) =>
      _api.page('/notes', query, Note.fromJson);
}

final notesRepositoryProvider = Provider<NotesRepository>(
  (ref) => NotesRepository(ref.watch(apiClientProvider)),
);

/// Local database: the app's own tables. kashi_sync adds kashi_outbox and kashi_sync_state itself.
library;

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'database.g.dart';

@DataClassName('LocalNote')
class Notes extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get body => text().withDefault(const Constant(''))();
  TextColumn get updatedAt => text()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [Notes])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? executor])
    : super(executor ?? driftDatabase(name: 'kashi_example'));

  @override
  int get schemaVersion => 1;
}

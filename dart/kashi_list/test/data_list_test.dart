import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_list/kashi_list.dart';
import 'package:kashi_ui/kashi_ui.dart';

final all = List.generate(60, (i) => 'Item ${i.toString().padLeft(2, '0')}');

/// Fake keyset API over `all`: cursor is the index of the next item.
Future<KPage<String>> fakeFetch(
  Map<String, dynamic> q,
  List<Map<String, dynamic>> log, {
  bool fail = false,
}) async {
  log.add(q);
  await Future<void>.delayed(const Duration(milliseconds: 10));
  if (fail) throw const NetworkFailure();
  var rows = all
      .where((s) => s.toLowerCase().contains((q['q'] as String).toLowerCase()))
      .toList();
  if (q['direction'] == 'desc') rows = rows.reversed.toList();
  final start = int.tryParse('${q['cursor'] ?? 0}') ?? 0;
  final limit = q['limit'] as int;
  final end = (start + limit).clamp(0, rows.length);
  return KPage(
    items: rows.sublist(start, end),
    next: end < rows.length ? '$end' : null,
  );
}

Widget app(Widget child) => CupertinoApp(
  theme: kashiCupertinoTheme(),
  home: CupertinoPageScaffold(child: child),
);

void main() {
  testWidgets('loads, scrolls to load more, searches and sorts', (
    tester,
  ) async {
    final log = <Map<String, dynamic>>[];
    final ctl = KDirectoryController<String>(
      fetch: (q) => fakeFetch(q, log),
      sort: 'name',
      limit: 20,
    );
    await tester.pumpWidget(
      app(
        KDataList<String>(
          controller: ctl,
          sortOptions: const {'name': 'Name'},
          itemBuilder: (_, s) => Text(s),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Item 00'), findsOneWidget);
    expect(ctl.items.length, 20);

    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, -3000),
      3000,
    );
    await tester.pumpAndSettle();
    expect(ctl.items.length, greaterThan(20));
    expect(log.last['cursor'], isNotNull);

    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, 6000),
      3000,
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(CupertinoSearchTextField), '5');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(log.last['q'], '5');
    expect(
      log.last.containsKey('cursor'),
      isFalse,
      reason: 'search restarts from page one',
    );
    expect(ctl.items.every((s) => s.contains('5')), isTrue);

    ctl.setSort('name');
    await tester.pumpAndSettle();
    expect(log.last['direction'], 'desc');
    expect(ctl.items.first, 'Item 59');
  });

  testWidgets('shows empty and error states with retry', (tester) async {
    final log = <Map<String, dynamic>>[];
    var fail = true;
    final ctl = KDirectoryController<String>(
      fetch: (q) => fakeFetch(q, log, fail: fail),
      sort: 'name',
    );
    await tester.pumpWidget(
      app(KDataList<String>(controller: ctl, itemBuilder: (_, s) => Text(s))),
    );
    await tester.pumpAndSettle();
    expect(find.byType(KAlert), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Item 00'), findsOneWidget);

    ctl.setSearch('zzz');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    expect(find.text('No results for “zzz”'), findsOneWidget);
  });

  test('stale responses are ignored after a newer request', () async {
    final calls = <String>[];
    final ctl = KDirectoryController<String>(
      fetch: (q) async {
        calls.add(q['q'] as String);
        await Future<void>.delayed(
          Duration(milliseconds: q['q'] == '' ? 50 : 5),
        );
        return KPage(items: ['${q['q']}-result']);
      },
      sort: 'name',
      debounce: Duration.zero,
    );
    final first = ctl.refresh();
    ctl.setSearch('x');
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await first;
    expect(ctl.items, ['x-result']);
  });

  test('a response after dispose is ignored instead of throwing', () async {
    final ctl = KDirectoryController<String>(
      fetch: (q) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return const KPage(items: ['a']);
      },
      sort: 'name',
    );
    final pending = ctl.refresh();
    ctl.dispose();
    await pending;
  });
}

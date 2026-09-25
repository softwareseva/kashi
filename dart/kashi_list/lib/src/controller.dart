/// State for a server-driven list: search, sort, and cursor paging appended as the user scrolls.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:kashi_core/kashi_core.dart';

enum KSortDirection { asc, desc }

/// Fetches one page. `query` holds `q`, `sort`, `direction`, `limit`, and `cursor` (when paging).
typedef KPageFetcher<T> = Future<KPage<T>> Function(Map<String, dynamic> query);

class KDirectoryController<T> extends ChangeNotifier {
  KDirectoryController({
    required this.fetch,
    required String sort,
    KSortDirection direction = KSortDirection.asc,
    this.limit = 25,
    this.debounce = const Duration(milliseconds: 300),
    Map<String, dynamic> filters = const {},
  }) : _sort = sort, // ignore: prefer_initializing_formals
       _direction = direction, // ignore: prefer_initializing_formals
       _filters = Map.of(filters);

  final KPageFetcher<T> fetch;
  final int limit;
  final Duration debounce;

  String _q = '';
  String _sort;
  KSortDirection _direction;
  final Map<String, dynamic> _filters;
  List<T> _items = const [];
  String? _next;
  bool _loading = false;
  bool _loadingMore = false;
  KashiFailure? _failure;
  bool _loaded = false;
  int _generation = 0;
  Timer? _searchTimer;
  bool _disposed = false;

  /// Responses can arrive after the screen closed; never notify a disposed controller.
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  String get q => _q;
  String get sort => _sort;
  KSortDirection get direction => _direction;
  Map<String, dynamic> get filters => Map.unmodifiable(_filters);
  List<T> get items => _items;
  bool get loading => _loading;
  bool get loadingMore => _loadingMore;
  bool get hasMore => _next != null;
  bool get loaded => _loaded;
  KashiFailure? get failure => _failure;

  Map<String, dynamic> _query([String? cursor]) => {
    'q': _q,
    'sort': _sort,
    'direction': _direction.name,
    'limit': limit,
    ..._filters,
    'cursor': ?cursor,
  };

  /// Reload from the first page. Any in-flight request is ignored when it returns.
  Future<void> refresh() async {
    if (_disposed) return;
    final gen = ++_generation;
    _loading = true;
    _failure = null;
    _notify();
    try {
      final page = await fetch(_query());
      if (gen != _generation) return;
      _items = page.items;
      _next = page.next;
      _loaded = true;
    } on KashiFailure catch (f) {
      if (gen != _generation) return;
      _failure = f;
    } finally {
      if (gen == _generation) {
        _loading = false;
        _notify();
      }
    }
  }

  /// Append the next page. Safe to call repeatedly from a scroll listener.
  Future<void> loadMore() async {
    final cursor = _next;
    if (cursor == null || _loading || _loadingMore) return;
    final gen = _generation;
    _loadingMore = true;
    _notify();
    try {
      final page = await fetch(_query(cursor));
      if (gen != _generation) return;
      _items = [..._items, ...page.items];
      _next = page.next;
    } on KashiFailure catch (f) {
      if (gen == _generation) _failure = f;
    } finally {
      if (gen == _generation) {
        _loadingMore = false;
        _notify();
      }
    }
  }

  /// Debounced; an unchanged query does nothing.
  void setSearch(String value) {
    _searchTimer?.cancel();
    _searchTimer = Timer(debounce, () {
      if (value.trim() == _q) return;
      _q = value.trim();
      refresh();
    });
  }

  /// Same key flips the direction; a new key starts ascending (or [direction] when given).
  void setSort(String key, {KSortDirection? direction}) {
    _direction =
        direction ??
        (key == _sort
            ? (_direction == KSortDirection.asc
                  ? KSortDirection.desc
                  : KSortDirection.asc)
            : KSortDirection.asc);
    _sort = key;
    refresh();
  }

  void setFilter(String name, Object? value) {
    if (value == null || value == '') {
      _filters.remove(name);
    } else {
      _filters[name] = value;
    }
    refresh();
  }

  /// Replace or remove one item locally after an edit, without refetching.
  void updateWhere(bool Function(T) test, T? replacement) {
    _items = [
      for (final i in _items)
        if (!test(i)) i else ?replacement,
    ];
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _searchTimer?.cancel();
    super.dispose();
  }
}

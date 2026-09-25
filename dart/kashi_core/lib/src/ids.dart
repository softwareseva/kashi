/// Time-sortable ids compatible with `@softwareseva/core` `newId()`: `<prefix>_<base36 ms><12 hex>`.
library;

import 'dart:math';

final _random = Random.secure();

String newId(String prefix) {
  final time = DateTime.now().millisecondsSinceEpoch
      .toRadixString(36)
      .padLeft(9, '0');
  final rand = List.generate(
    12,
    (_) => _random.nextInt(16).toRadixString(16),
  ).join();
  return '${prefix}_$time$rand';
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_core/kashi_core.dart';

void main() {
  test('app config provider must be overridden', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(
      () => container.read(kashiConfigProvider),
      throwsA(predicate((e) => '$e'.contains('Override kashiConfigProvider'))),
    );
  });
}

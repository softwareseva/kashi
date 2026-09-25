import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kashi_ui/kashi_ui.dart';

void main() {
  testWidgets('KColors.of follows the theme brightness', (tester) async {
    late KColors light, dark;
    await tester.pumpWidget(
      CupertinoApp(
        theme: kashiCupertinoTheme(brightness: Brightness.light),
        home: Builder(
          builder: (c) {
            light = KColors.of(c);
            return const SizedBox();
          },
        ),
      ),
    );
    await tester.pumpWidget(
      CupertinoApp(
        theme: kashiCupertinoTheme(brightness: Brightness.dark),
        home: Builder(
          builder: (c) {
            dark = KColors.of(c);
            return const SizedBox();
          },
        ),
      ),
    );
    expect(light.surface, KColors.light.surface);
    expect(dark.surface, KColors.dark.surface);
  });

  testWidgets('KButton renders its label and disables without onPressed', (
    tester,
  ) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: Center(child: KButton(label: 'Save', onPressed: null)),
      ),
    );
    expect(find.text('Save'), findsOneWidget);
  });
}

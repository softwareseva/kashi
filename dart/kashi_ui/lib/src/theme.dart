import 'package:flutter/cupertino.dart';

import 'tokens.dart';

/// Cupertino theme for kashi apps (default kaushik tokens).
///
/// Leave [brightness] null to follow the platform (colors are dynamic):
/// `CupertinoApp(theme: kashiCupertinoTheme(), home: ...)`.
CupertinoThemeData kashiCupertinoTheme({Brightness? brightness}) {
  const l = KColors.light;
  const k = KColors.dark;
  CupertinoDynamicColor dyn(Color light, Color dark) =>
      CupertinoDynamicColor.withBrightness(color: light, darkColor: dark);

  return CupertinoThemeData(
    brightness: brightness,
    // Cupertino uses primaryColor for text buttons, nav actions and switches,
    // so it takes the text-safe focus color, not saffron.
    primaryColor: dyn(l.focusRing, k.focusRing),
    primaryContrastingColor: dyn(l.onSaffron, k.onSaffron),
    scaffoldBackgroundColor: dyn(l.surface, k.surface),
    barBackgroundColor: dyn(l.surface, k.surface),
    textTheme: CupertinoTextThemeData(
      primaryColor: dyn(l.focusRing, k.focusRing),
      textStyle: KText.body.copyWith(color: dyn(l.ink, k.ink)),
      navTitleTextStyle: KText.body.copyWith(
        fontWeight: FontWeight.w600,
        color: dyn(l.ink, k.ink),
      ),
      navLargeTitleTextStyle: KText.title.copyWith(
        fontSize: 34,
        height: 41 / 34,
        color: dyn(l.ink, k.ink),
      ),
    ),
  );
}

import 'package:flutter/cupertino.dart';

/// Color tokens. Mirrors packages/tokens/tokens.json; read with `KColors.of(context)`.
@immutable
class KColors {
  const KColors({
    required this.surface,
    required this.surfaceRaised,
    required this.ink,
    required this.inkMuted,
    required this.border,
    required this.borderStrong,
    required this.saffron,
    required this.saffronSoft,
    required this.saffronStrong,
    required this.onSaffronStrong,
    required this.terracotta,
    required this.sage,
    required this.danger,
    required this.focusRing,
    required this.onSaffron,
    required this.onDanger,
  });

  /// Page background.
  final Color surface;

  /// Cards, sheets, inputs.
  final Color surfaceRaised;

  /// Primary text and icons.
  final Color ink;

  /// Secondary text, captions, placeholders.
  final Color inkMuted;

  /// Decorative hairlines only.
  final Color border;

  /// Control borders (inputs, outline buttons) — 3:1 on surfaces.
  final Color borderStrong;

  /// Brand fill: primary button, active state. Never text on surface.
  final Color saffron;

  /// Tinted backgrounds: selection, highlights, brand badges.
  final Color saffronSoft;

  /// Checked/selected controls: checkbox, radio, switch, select tick (3:1+).
  final Color saffronStrong;

  /// Check marks and thumbs on saffronStrong.
  final Color onSaffronStrong;

  /// Links and secondary emphasis; safe as text.
  final Color terracotta;

  /// Success text/icons.
  final Color sage;

  /// Errors and destructive actions.
  final Color danger;

  /// Focus outline and Cupertino primaryColor.
  final Color focusRing;

  /// Text on saffron.
  final Color onSaffron;

  /// Text on danger.
  final Color onDanger;

  static const light = KColors(
    surface: Color(0xFFFBF7F0),
    surfaceRaised: Color(0xFFFFFFFF),
    ink: Color(0xFF2A2119),
    inkMuted: Color(0xFF6B5D4F),
    border: Color(0xFFE6DCCD),
    borderStrong: Color(0xFF8C7C6A),
    saffron: Color(0xFFE8891C),
    saffronSoft: Color(0xFFFBE6C8),
    saffronStrong: Color(0xFFB9640C),
    onSaffronStrong: Color(0xFFFFFFFF),
    terracotta: Color(0xFFA8481F),
    sage: Color(0xFF4F6B40),
    danger: Color(0xFFB3261E),
    focusRing: Color(0xFFA8481F),
    onSaffron: Color(0xFF2A2119),
    onDanger: Color(0xFFFBF7F0),
  );

  static const dark = KColors(
    surface: Color(0xFF1C1814),
    surfaceRaised: Color(0xFF26211C),
    ink: Color(0xFFF4EDE3),
    inkMuted: Color(0xFFB5A795),
    border: Color(0xFF3A332B),
    borderStrong: Color(0xFF85776A),
    saffron: Color(0xFFF0A040),
    saffronSoft: Color(0xFF4A3520),
    saffronStrong: Color(0xFFF0A040),
    onSaffronStrong: Color(0xFF1C1814),
    terracotta: Color(0xFFE8845C),
    sage: Color(0xFF9BB584),
    danger: Color(0xFFF2877C),
    focusRing: Color(0xFFF0A040),
    onSaffron: Color(0xFF1C1814),
    onDanger: Color(0xFF1C1814),
  );

  /// Light or dark set, following the Cupertino theme, then the platform.
  static KColors of(BuildContext context) {
    final brightness =
        CupertinoTheme.maybeBrightnessOf(context) ??
        MediaQuery.maybePlatformBrightnessOf(context) ??
        Brightness.light;
    return brightness == Brightness.dark ? dark : light;
  }
}

/// 8px spacing grid.
abstract final class KSpace {
  static const double s2 = 8;
  static const double s4 = 16;
  static const double s6 = 24;
  static const double s8 = 32;
}

/// Corner radii.
abstract final class KRadius {
  static const double sm = 6;
  static const double md = 10;
  static const double lg = 16;

  static const BorderRadius smAll = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll = BorderRadius.all(Radius.circular(lg));
}

/// Type scale. Colorless: apply `.copyWith(color: KColors.of(context).ink)`.
/// Uses the platform font (SF Pro on iOS); set [family] to 'Inter' if you bundle it.
abstract final class KText {
  static const String? family = null;

  static const TextStyle display = TextStyle(
    fontFamily: family,
    fontSize: 40,
    height: 44 / 40,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.4,
  );
  static const TextStyle title = TextStyle(
    fontFamily: family,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
  );
  static const TextStyle heading = TextStyle(
    fontFamily: family,
    fontSize: 20,
    height: 28 / 20,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle body = TextStyle(
    fontFamily: family,
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w400,
  );
  static const TextStyle bodySm = TextStyle(
    fontFamily: family,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w400,
  );
  static const TextStyle label = TextStyle(
    fontFamily: family,
    fontSize: 13,
    height: 18 / 13,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle code = TextStyle(
    fontFamily: 'JetBrainsMono',
    fontFamilyFallback: ['Menlo', 'Courier', 'monospace'],
    fontSize: 13,
    height: 20 / 13,
  );
}

/// Standard icons for icon buttons, so both platforms use the same set.
/// Web uses the Lucide equivalents named in each comment.
abstract final class KIcons {
  static const IconData search = CupertinoIcons.search; // Search
  static const IconData close = CupertinoIcons.xmark; // X
  static const IconData menu = CupertinoIcons.bars; // Menu
  static const IconData more = CupertinoIcons.ellipsis; // Ellipsis
  static const IconData add = CupertinoIcons.add; // Plus
  static const IconData back = CupertinoIcons.back; // ArrowLeft / ChevronLeft
  static const IconData settings = CupertinoIcons.settings; // Settings
  static const IconData filter =
      CupertinoIcons.slider_horizontal_3; // SlidersHorizontal
  static const IconData share = CupertinoIcons.share; // Share
  static const IconData edit = CupertinoIcons.pencil; // Pencil
  static const IconData delete = CupertinoIcons.delete; // Trash2
  static const IconData notifications = CupertinoIcons.bell; // Bell
  static const IconData chevronDown =
      CupertinoIcons.chevron_down; // ChevronDown
  static const IconData check = CupertinoIcons.checkmark; // Check
}

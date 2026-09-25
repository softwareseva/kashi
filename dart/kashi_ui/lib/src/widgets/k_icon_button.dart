import 'package:flutter/cupertino.dart';

import '../tokens.dart';

enum KIconButtonVariant { ghost, outline, secondary, primary }

/// Square icon-only button (search, close, more…). [label] is required for VoiceOver.
class KIconButton extends StatefulWidget {
  const KIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.variant = KIconButtonVariant.ghost,
    this.small = false,
  });

  /// Prefer [KIcons] (e.g. `KIcons.search`).
  final IconData icon;

  /// Spoken name: "Search", "Close".
  final String label;
  final VoidCallback? onPressed;
  final KIconButtonVariant variant;

  /// 36pt instead of 44pt. Keep 44pt for primary navigation.
  final bool small;

  @override
  State<KIconButton> createState() => _KIconButtonState();
}

class _KIconButtonState extends State<KIconButton> {
  bool _pressed = false;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final enabled = widget.onPressed != null;
    final (Color? bg, Color fg, Color? border) = switch (widget.variant) {
      KIconButtonVariant.ghost => (
        _pressed ? c.saffronSoft : null,
        c.ink,
        null,
      ),
      KIconButtonVariant.outline => (
        _pressed ? c.saffronSoft : c.surfaceRaised,
        c.ink,
        c.borderStrong,
      ),
      KIconButtonVariant.secondary => (c.saffronSoft, c.ink, null),
      KIconButtonVariant.primary => (c.saffron, c.onSaffron, null),
    };
    final side = widget.small ? 36.0 : 44.0;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled ? (_) => _set(true) : null,
        onTapUp: enabled ? (_) => _set(false) : null,
        onTapCancel: enabled ? () => _set(false) : null,
        onTap: widget.onPressed,
        child: Opacity(
          opacity: enabled
              ? (_pressed &&
                        bg != null &&
                        widget.variant != KIconButtonVariant.ghost
                    ? 0.85
                    : 1)
              : 0.5,
          child: Container(
            width: side,
            height: side,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: KRadius.mdAll,
              border: border == null ? null : Border.all(color: border),
            ),
            child: Icon(widget.icon, size: 20, color: fg),
          ),
        ),
      ),
    );
  }
}

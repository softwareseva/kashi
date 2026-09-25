import 'package:flutter/cupertino.dart';

import '../tokens.dart';

enum KButtonVariant { primary, secondary, outline, ghost, destructive }

enum KButtonSize { sm, md, lg }

/// Tappable action. One `primary` per screen; `destructive` only for irreversible actions.
class KButton extends StatefulWidget {
  const KButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = KButtonVariant.primary,
    this.size = KButtonSize.md,
    this.icon,
    this.loading = false,
    this.expand = false,
  });

  /// Sentence-case verb phrase: "Publish post".
  final String label;

  /// Null disables the button.
  final VoidCallback? onPressed;
  final KButtonVariant variant;
  final KButtonSize size;

  /// Optional leading icon (CupertinoIcons or Lucide).
  final IconData? icon;

  /// Shows a spinner and blocks taps.
  final bool loading;

  /// Fill the available width.
  final bool expand;

  @override
  State<KButton> createState() => _KButtonState();
}

class _KButtonState extends State<KButton> {
  bool _pressed = false;

  bool get _enabled => widget.onPressed != null && !widget.loading;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);

    final (Color? bg, Color fg, Color? border) = switch (widget.variant) {
      KButtonVariant.primary => (c.saffron, c.onSaffron, null),
      KButtonVariant.secondary => (c.saffronSoft, c.ink, null),
      KButtonVariant.outline => (c.surfaceRaised, c.ink, c.borderStrong),
      KButtonVariant.ghost => (null, c.ink, null),
      KButtonVariant.destructive => (c.danger, c.onDanger, null),
    };

    final (double height, double padX, TextStyle text) = switch (widget.size) {
      KButtonSize.sm => (36.0, 12.0, KText.bodySm),
      KButtonSize.md => (44.0, KSpace.s4, KText.bodySm),
      KButtonSize.lg => (52.0, KSpace.s6, KText.body),
    };

    final textStyle = text.copyWith(color: fg, fontWeight: FontWeight.w500);

    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading) ...[
          CupertinoActivityIndicator(color: fg, radius: 8),
          const SizedBox(width: KSpace.s2),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon, size: 18, color: fg),
          const SizedBox(width: KSpace.s2),
        ],
        Flexible(
          child: Text(
            widget.label,
            style: textStyle,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );

    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _enabled ? (_) => _setPressed(true) : null,
        onTapUp: _enabled ? (_) => _setPressed(false) : null,
        onTapCancel: _enabled ? () => _setPressed(false) : null,
        onTap: _enabled ? widget.onPressed : null,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 120),
          opacity: !_enabled && !widget.loading ? 0.5 : (_pressed ? 0.8 : 1),
          child: Container(
            height: height,
            padding: EdgeInsets.symmetric(horizontal: padX),
            decoration: BoxDecoration(
              color: widget.variant == KButtonVariant.ghost && _pressed
                  ? c.saffronSoft
                  : bg,
              borderRadius: KRadius.mdAll,
              border: border == null ? null : Border.all(color: border),
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}

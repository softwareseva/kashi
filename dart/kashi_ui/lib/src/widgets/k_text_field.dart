import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// Labeled single-line input with hint or error text.
class KTextField extends StatefulWidget {
  const KTextField({
    super.key,
    required this.label,
    this.controller,
    this.placeholder,
    this.hint,
    this.errorText,
    this.obscureText = false,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.focusNode,
  });

  /// Always visible above the field; never rely on the placeholder alone.
  final String label;
  final TextEditingController? controller;
  final String? placeholder;

  /// Helper text under the field; replaced by [errorText] when set.
  final String? hint;

  /// Says what went wrong and how to fix it.
  final String? errorText;
  final bool obscureText;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FocusNode? focusNode;

  @override
  State<KTextField> createState() => _KTextFieldState();
}

class _KTextFieldState extends State<KTextField> {
  FocusNode? _ownNode;
  FocusNode get _node => widget.focusNode ?? (_ownNode ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _node.addListener(_onFocus);
  }

  @override
  void didUpdateWidget(KTextField old) {
    super.didUpdateWidget(old);
    if (old.focusNode != widget.focusNode) {
      (old.focusNode ?? _ownNode)?.removeListener(_onFocus);
      _node.addListener(_onFocus);
    }
  }

  void _onFocus() => setState(() {});

  @override
  void dispose() {
    _node.removeListener(_onFocus);
    _ownNode?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final hasError = widget.errorText != null;
    final focused = _node.hasFocus;
    final borderColor = hasError
        ? c.danger
        : (focused ? c.focusRing : c.borderStrong);
    final below = widget.errorText ?? widget.hint;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(widget.label, style: KText.label.copyWith(color: c.ink)),
        const SizedBox(height: KSpace.s2),
        Opacity(
          opacity: widget.enabled ? 1 : 0.5,
          child: CupertinoTextField(
            controller: widget.controller,
            focusNode: _node,
            enabled: widget.enabled,
            obscureText: widget.obscureText,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            onChanged: widget.onChanged,
            onSubmitted: widget.onSubmitted,
            placeholder: widget.placeholder,
            placeholderStyle: KText.bodySm.copyWith(color: c.inkMuted),
            style: KText.body.copyWith(color: c.ink),
            cursorColor: c.focusRing,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(
              color: c.surfaceRaised,
              borderRadius: KRadius.mdAll,
              border: Border.all(
                color: borderColor,
                width: focused || hasError ? 2 : 1,
              ),
            ),
          ),
        ),
        if (below != null) ...[
          const SizedBox(height: 6),
          Semantics(
            liveRegion: hasError,
            child: Text(
              below,
              style: KText.bodySm.copyWith(
                color: hasError ? c.danger : c.inkMuted,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

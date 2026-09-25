import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// One choice in a [KSelect].
@immutable
class KOption<T> {
  const KOption(this.value, this.label);
  final T value;
  final String label;
}

/// Dropdown for picking one value from a short list. Opens a Cupertino action
/// sheet with a check mark on the current value. Over ~7 options, use a search list.
class KSelect<T> extends StatelessWidget {
  const KSelect({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.placeholder = 'Choose…',
    this.hint,
    this.errorText,
  });

  final String label;
  final List<KOption<T>> options;
  final T? value;

  /// Null disables the field.
  final ValueChanged<T>? onChanged;
  final String placeholder;
  final String? hint;
  final String? errorText;

  Future<void> _open(BuildContext context) async {
    final picked = await showCupertinoModalPopup<T>(
      context: context,
      builder: (sheetContext) {
        final c = KColors.of(sheetContext);
        return CupertinoActionSheet(
          title: Text(label),
          actions: [
            for (final o in options)
              CupertinoActionSheetAction(
                onPressed: () => Navigator.of(sheetContext).pop(o.value),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        o.label,
                        style: KText.body.copyWith(color: c.ink),
                      ),
                    ),
                    if (o.value == value) ...[
                      const SizedBox(width: KSpace.s2),
                      Icon(KIcons.check, size: 18, color: c.saffronStrong),
                    ],
                  ],
                ),
              ),
          ],
          cancelButton: CupertinoActionSheetAction(
            onPressed: () => Navigator.of(sheetContext).pop(),
            child: const Text('Cancel'),
          ),
        );
      },
    );
    if (picked != null) onChanged?.call(picked);
  }

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final enabled = onChanged != null;
    final hasError = errorText != null;
    String? selected;
    for (final o in options) {
      if (o.value == value) selected = o.label;
    }
    final below = errorText ?? hint;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: KText.label.copyWith(color: c.ink)),
        const SizedBox(height: KSpace.s2),
        Semantics(
          button: true,
          enabled: enabled,
          label: label,
          value: selected ?? placeholder,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: enabled ? () => _open(context) : null,
            child: Opacity(
              opacity: enabled ? 1 : 0.5,
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: c.surfaceRaised,
                  borderRadius: KRadius.mdAll,
                  border: Border.all(
                    color: hasError ? c.danger : c.borderStrong,
                    width: hasError ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        selected ?? placeholder,
                        overflow: TextOverflow.ellipsis,
                        style: KText.body.copyWith(
                          color: selected == null ? c.inkMuted : c.ink,
                        ),
                      ),
                    ),
                    Icon(KIcons.chevronDown, size: 16, color: c.inkMuted),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (below != null) ...[
          const SizedBox(height: 6),
          Text(
            below,
            style: KText.bodySm.copyWith(
              color: hasError ? c.danger : c.inkMuted,
            ),
          ),
        ],
      ],
    );
  }
}

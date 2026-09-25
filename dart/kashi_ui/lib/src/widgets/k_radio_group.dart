import 'package:flutter/cupertino.dart';

import '../tokens.dart';
import 'k_select.dart' show KOption;

/// A short, always-visible list of mutually exclusive choices (2–5).
/// Longer lists: use [KSelect].
class KRadioGroup<T> extends StatelessWidget {
  const KRadioGroup({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.label,
    this.descriptions,
  });

  final List<KOption<T>> options;
  final T? value;

  /// Null disables the group.
  final ValueChanged<T>? onChanged;

  /// Group heading, read before the options.
  final String? label;

  /// Optional secondary line per value.
  final Map<T, String>? descriptions;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    return Semantics(
      container: true,
      label: label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (label != null) ...[
            Text(label!, style: KText.label.copyWith(color: c.ink)),
            const SizedBox(height: KSpace.s2),
          ],
          for (final o in options)
            _RadioRow<T>(
              option: o,
              description: descriptions?[o.value],
              selected: o.value == value,
              onTap: onChanged == null ? null : () => onChanged!(o.value),
            ),
        ],
      ),
    );
  }
}

class _RadioRow<T> extends StatelessWidget {
  const _RadioRow({
    required this.option,
    required this.selected,
    required this.onTap,
    this.description,
  });

  final KOption<T> option;
  final String? description;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      enabled: onTap != null,
      label: option.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.5 : 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 44),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 120),
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: c.surfaceRaised,
                      border: Border.all(
                        color: selected ? c.saffronStrong : c.borderStrong,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: selected
                        ? Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: c.saffronStrong,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          option.label,
                          style: KText.body.copyWith(color: c.ink),
                        ),
                        if (description != null)
                          Text(
                            description!,
                            style: KText.bodySm.copyWith(color: c.inkMuted),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

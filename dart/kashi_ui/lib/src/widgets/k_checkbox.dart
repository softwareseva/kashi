import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// Independent yes/no choice, usually part of a form. The whole row is tappable.
class KCheckbox extends StatelessWidget {
  const KCheckbox({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
    this.description,
  });

  final bool value;

  /// Null disables it.
  final ValueChanged<bool>? onChanged;
  final String label;
  final String? description;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final enabled = onChanged != null;
    return Semantics(
      checked: value,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? () => onChanged!(!value) : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
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
                      color: value ? c.saffronStrong : c.surfaceRaised,
                      borderRadius: KRadius.smAll,
                      border: Border.all(
                        color: value ? c.saffronStrong : c.borderStrong,
                      ),
                    ),
                    child: value
                        ? Icon(KIcons.check, size: 16, color: c.onSaffronStrong)
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: KText.body.copyWith(color: c.ink)),
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

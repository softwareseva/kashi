import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// Setting that takes effect immediately, as a labeled row. Uses the native
/// CupertinoSwitch with brand colors.
class KSwitch extends StatelessWidget {
  const KSwitch({
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
    return MergeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
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
            const SizedBox(width: 12),
            CupertinoSwitch(
              value: value,
              onChanged: onChanged,
              activeTrackColor: c.saffronStrong,
              inactiveTrackColor: c.borderStrong,
              thumbColor: c.surfaceRaised,
            ),
          ],
        ),
      ),
    );
  }
}

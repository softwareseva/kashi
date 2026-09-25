import 'package:flutter/cupertino.dart';

import '../tokens.dart';

enum KBadgeVariant { neutral, brand, success, danger }

/// Short status or category label. Keep to one or two words.
class KBadge extends StatelessWidget {
  const KBadge(
    this.label, {
    super.key,
    this.variant = KBadgeVariant.neutral,
    this.icon,
  });

  final String label;
  final KBadgeVariant variant;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final (Color bg, Color fg, Color? border) = switch (variant) {
      KBadgeVariant.neutral => (c.surface, c.inkMuted, c.border),
      KBadgeVariant.brand => (c.saffronSoft, c.ink, null),
      KBadgeVariant.success => (c.surface, c.sage, c.border),
      KBadgeVariant.danger => (c.surface, c.danger, c.border),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: KSpace.s2, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: KRadius.smAll,
        border: border == null ? null : Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 4),
          ],
          Text(label, style: KText.label.copyWith(color: fg)),
        ],
      ),
    );
  }
}

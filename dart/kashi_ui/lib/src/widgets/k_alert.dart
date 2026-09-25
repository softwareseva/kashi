import 'package:flutter/cupertino.dart';

import '../tokens.dart';

enum KAlertVariant { info, success, danger }

/// Inline message about the current screen. Always carries an icon, never color alone.
class KAlert extends StatelessWidget {
  const KAlert({
    super.key,
    required this.title,
    this.message,
    this.variant = KAlertVariant.info,
    this.icon,
  });

  final String title;
  final String? message;
  final KAlertVariant variant;

  /// Overrides the default icon for the variant.
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final (
      Color bg,
      Color borderColor,
      Color iconColor,
      IconData defaultIcon,
    ) = switch (variant) {
      KAlertVariant.info => (
        c.saffronSoft,
        c.border,
        c.ink,
        CupertinoIcons.info_circle,
      ),
      KAlertVariant.success => (
        c.surfaceRaised,
        c.border,
        c.sage,
        CupertinoIcons.check_mark_circled,
      ),
      KAlertVariant.danger => (
        c.surfaceRaised,
        c.danger,
        c.danger,
        CupertinoIcons.exclamationmark_triangle,
      ),
    };
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(KSpace.s4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: KRadius.lgAll,
          border: Border.all(color: borderColor),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(icon ?? defaultIcon, size: 20, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: KText.bodySm.copyWith(
                      color: c.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (message != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      message!,
                      style: KText.bodySm.copyWith(color: c.inkMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

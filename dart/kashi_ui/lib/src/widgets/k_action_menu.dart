import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// One row in [showKActionMenu].
@immutable
class KMenuAction {
  const KMenuAction({
    required this.label,
    required this.onSelected,
    this.icon,
    this.destructive = false,
  });
  final String label;
  final VoidCallback onSelected;
  final IconData? icon;
  final bool destructive;
}

/// Action menu (the "More" button's menu). iOS convention: a bottom action sheet.
/// For picking a value, use [KSelect] instead.
Future<void> showKActionMenu(
  BuildContext context, {
  String? title,
  required List<KMenuAction> actions,
}) async {
  final chosen = await showCupertinoModalPopup<KMenuAction>(
    context: context,
    builder: (sheetContext) {
      final c = KColors.of(sheetContext);
      return CupertinoActionSheet(
        title: title == null ? null : Text(title),
        actions: [
          for (final a in actions)
            CupertinoActionSheetAction(
              isDestructiveAction: a.destructive,
              onPressed: () => Navigator.of(sheetContext).pop(a),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (a.icon != null) ...[
                    Icon(
                      a.icon,
                      size: 20,
                      color: a.destructive ? c.danger : c.ink,
                    ),
                    const SizedBox(width: KSpace.s2),
                  ],
                  Text(
                    a.label,
                    style: KText.body.copyWith(
                      color: a.destructive ? c.danger : c.ink,
                    ),
                  ),
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
  chosen?.onSelected();
}

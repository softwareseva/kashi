import 'package:flutter/cupertino.dart';

import '../tokens.dart';

/// Raised surface that groups related content. Hairline border, no shadow.
class KCard extends StatelessWidget {
  const KCard({
    super.key,
    required this.child,
    this.title,
    this.description,
    this.padding = const EdgeInsets.all(KSpace.s4),
    this.onTap,
  });

  final Widget child;
  final String? title;
  final String? description;
  final EdgeInsetsGeometry padding;

  /// Makes the whole card tappable (e.g. a list row that opens detail).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: c.surfaceRaised,
        borderRadius: KRadius.lgAll,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null)
            Text(title!, style: KText.heading.copyWith(color: c.ink)),
          if (description != null) ...[
            const SizedBox(height: 4),
            Text(description!, style: KText.bodySm.copyWith(color: c.inkMuted)),
          ],
          if (title != null || description != null)
            const SizedBox(height: KSpace.s4),
          child,
        ],
      ),
    );
    if (onTap == null) return body;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: body,
      ),
    );
  }
}

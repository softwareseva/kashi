/// Cupertino list for a KDirectoryController: search, sort sheet, pull-to-refresh, infinite scroll, states.
library;

import 'package:flutter/cupertino.dart';
import 'package:kashi_ui/kashi_ui.dart';

import 'controller.dart';

class KDataList<T> extends StatefulWidget {
  const KDataList({
    super.key,
    required this.controller,
    required this.itemBuilder,
    this.sortOptions = const {},
    this.searchPlaceholder = 'Search',
    this.emptyTitle = 'Nothing here yet',
    this.emptyMessage,
    this.onTap,
    this.header,
    this.searchable = true,
  });

  final KDirectoryController<T> controller;

  /// Row content; the list adds padding, dividers and the tap highlight.
  final Widget Function(BuildContext context, T item) itemBuilder;

  /// Sort key (API allowlist) to label. Empty hides the sort button.
  final Map<String, String> sortOptions;
  final String searchPlaceholder;
  final String emptyTitle;
  final String? emptyMessage;
  final void Function(T item)? onTap;

  /// Extra widget above the list (filters, summary).
  final Widget? header;
  final bool searchable;

  @override
  State<KDataList<T>> createState() => _KDataListState<T>();
}

class _KDataListState<T> extends State<KDataList<T>> {
  final _scroll = ScrollController();
  late final _search = TextEditingController(text: widget.controller.q);

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    if (!widget.controller.loaded && !widget.controller.loading) {
      widget.controller.refresh();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 400) widget.controller.loadMore();
  }

  Future<void> _chooseSort() => showKActionMenu(
    context,
    title: 'Sort by',
    actions: [
      for (final e in widget.sortOptions.entries)
        KMenuAction(
          label: e.key == widget.controller.sort
              ? '${e.value} (${widget.controller.direction == KSortDirection.asc ? 'ascending' : 'descending'})'
              : e.value,
          icon: e.key == widget.controller.sort ? KIcons.check : null,
          onSelected: () => widget.controller.setSort(e.key),
        ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final c = KColors.of(context);
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final ctl = widget.controller;
        return CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            CupertinoSliverRefreshControl(onRefresh: ctl.refresh),
            if (widget.searchable || widget.sortOptions.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  KSpace.s4,
                  KSpace.s2,
                  KSpace.s4,
                  KSpace.s2,
                ),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      if (widget.searchable)
                        Expanded(
                          child: CupertinoSearchTextField(
                            controller: _search,
                            placeholder: widget.searchPlaceholder,
                            onChanged: ctl.setSearch,
                            onSubmitted: ctl.setSearch,
                            style: KText.body.copyWith(color: c.ink),
                            backgroundColor: c.surfaceRaised,
                          ),
                        ),
                      if (widget.sortOptions.isNotEmpty) ...[
                        const SizedBox(width: KSpace.s2),
                        KIconButton(
                          icon: KIcons.filter,
                          label:
                              'Sort by ${widget.sortOptions[ctl.sort] ?? ctl.sort}',
                          onPressed: _chooseSort,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            if (widget.header != null) SliverToBoxAdapter(child: widget.header),
            if (ctl.failure != null && ctl.items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _State(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      KAlert(
                        variant: KAlertVariant.danger,
                        title: ctl.failure!.message,
                      ),
                      const SizedBox(height: KSpace.s4),
                      KButton(
                        label: 'Try again',
                        variant: KButtonVariant.outline,
                        onPressed: ctl.refresh,
                      ),
                    ],
                  ),
                ),
              )
            else if (ctl.loading && ctl.items.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CupertinoActivityIndicator()),
              )
            else if (ctl.items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _State(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        ctl.q.isEmpty
                            ? widget.emptyTitle
                            : 'No results for “${ctl.q}”',
                        style: KText.heading.copyWith(color: c.ink),
                        textAlign: TextAlign.center,
                      ),
                      if (widget.emptyMessage != null && ctl.q.isEmpty) ...[
                        const SizedBox(height: KSpace.s2),
                        Text(
                          widget.emptyMessage!,
                          style: KText.bodySm.copyWith(color: c.inkMuted),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
              )
            else
              SliverList.separated(
                itemCount: ctl.items.length,
                separatorBuilder: (_, _) => Container(
                  height: 0.5,
                  margin: const EdgeInsets.only(left: KSpace.s4),
                  color: c.border,
                ),
                itemBuilder: (context, i) {
                  final item = ctl.items[i];
                  final row = ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: KSpace.s4,
                        vertical: 12,
                      ),
                      child: widget.itemBuilder(context, item),
                    ),
                  );
                  return widget.onTap == null
                      ? row
                      : _Tappable(onTap: () => widget.onTap!(item), child: row);
                },
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(KSpace.s4),
                child: ctl.loadingMore
                    ? const Center(child: CupertinoActivityIndicator())
                    : ctl.failure != null && ctl.items.isNotEmpty
                    ? KButton(
                        label: 'Could not load more. Try again',
                        variant: KButtonVariant.ghost,
                        onPressed: ctl.loadMore,
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _State extends StatelessWidget {
  const _State({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(padding: const EdgeInsets.all(KSpace.s6), child: child),
  );
}

class _Tappable extends StatefulWidget {
  const _Tappable({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget child;
  @override
  State<_Tappable> createState() => _TappableState();
}

class _TappableState extends State<_Tappable> {
  bool _down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTapDown: (_) => setState(() => _down = true),
    onTapCancel: () => setState(() => _down = false),
    onTapUp: (_) => setState(() => _down = false),
    onTap: widget.onTap,
    child: Semantics(
      button: true,
      child: ColoredBox(
        color: _down
            ? KColors.of(context).saffronSoft
            : const Color(0x00000000),
        child: widget.child,
      ),
    ),
  );
}

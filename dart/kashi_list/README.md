# kashi_list

The Flutter side of `@kashi/list`. `KDirectoryController` owns search (debounced), sort, filters and cursor paging; `KDataList` renders it with pull-to-refresh, a search field, a sort sheet, infinite scroll, and loading, empty and error states on `kashi_ui`.

```dart
final notes = KDirectoryController<Note>(
  fetch: (q) => api.page('/notes', q, Note.fromJson),
  sort: 'updatedAt',
  direction: KSortDirection.desc,
);

KDataList<Note>(
  controller: notes,
  sortOptions: const {'updatedAt': 'Last updated', 'title': 'Title'},
  itemBuilder: (context, n) => Text(n.title),
  onTap: (n) => context.push('/notes/${n.id}'),
);
```

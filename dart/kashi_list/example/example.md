# kashi_list example

`KDirectoryController` drives search, sort and cursor paging; `KDataList`
renders it with pull-to-refresh, a sort sheet, and loading/empty/error
states.

```dart
import 'package:flutter/cupertino.dart';
import 'package:kashi_core/kashi_core.dart';
import 'package:kashi_list/kashi_list.dart';
import 'package:kashi_ui/kashi_ui.dart';

class PostsScreen extends StatefulWidget {
  const PostsScreen({super.key, required this.client});
  final KashiApiClient client;

  @override
  State<PostsScreen> createState() => _PostsScreenState();
}

class _PostsScreenState extends State<PostsScreen> {
  late final _controller = KDirectoryController<Map<String, dynamic>>(
    sort: 'createdAt',
    direction: KSortDirection.desc,
    fetch: (query) => widget.client.page<Map<String, dynamic>>(
      '/posts',
      query,
      (json) => json,
    ),
  )..refresh();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Posts')),
      child: KDataList<Map<String, dynamic>>(
        controller: _controller,
        sortOptions: const {'createdAt': 'Newest', 'title': 'Title'},
        itemBuilder: (context, post) => Text(post['title'] as String),
      ),
    );
  }
}
```

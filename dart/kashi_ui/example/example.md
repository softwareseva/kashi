# kashi_ui example

Apply the theme at the app root, then use the K-widgets anywhere below it.

```dart
import 'package:flutter/cupertino.dart';
import 'package:kashi_ui/kashi_ui.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoApp(
      theme: kashiCupertinoTheme(),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('Posts')),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.s4),
          child: KButton(
            label: 'Publish post',
            onPressed: () {},
            variant: KButtonVariant.primary,
          ),
        ),
      ),
    );
  }
}
```

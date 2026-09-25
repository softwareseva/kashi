# kashi_ui

Cupertino design tokens, theme and primitives for kashi apps. Ships the default **kaushik** theme with light and dark colour sets that follow the platform brightness.

```yaml
dependencies:
  kashi_ui: ^0.1.0
```

```dart
import 'package:kashi_ui/kashi_ui.dart';

CupertinoApp(theme: kashiCupertinoTheme(), home: ...);
```

Read colours with `KColors.of(context)`, spacing from `KSpace`, radii from `KRadius`, text styles from `KText` (apply a colour with `.copyWith`). Widgets: `KButton`, `KIconButton`, `showKActionMenu`, `KTextField`, `KSelect`, `KRadioGroup`, `KCheckbox`, `KSwitch`, `KCard`, `KBadge`, `KAlert`.

The same tokens back `@softwareseva/ui` on the web, so screens match across platforms. See the `kashi-ui-flutter` skill for usage rules.

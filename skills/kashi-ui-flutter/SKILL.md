---
name: kashi-ui-flutter
description: Style a Flutter (Cupertino) app with kashi_ui, covering the theme, colour and type tokens with light and dark, and the widgets (KButton, KIconButton, showKActionMenu, KTextField, KSelect, KRadioGroup, KCheckbox, KSwitch, KCard, KBadge, KAlert), plus KDataList from kashi_list for server-driven lists. Use when building Flutter screens, forms or lists, picking a widget, matching the web design, or rebranding colours in a Flutter app.
license: MIT
metadata:
  version: "0.1.0"
  packages: "kashi_ui@0.1 kashi_list@0.1"
---

# kashi UI in Flutter

`kashi_ui` is the Cupertino twin of `@kashi/ui`: the same tokens (from `tokens.json`), light and dark, and the same component set, so a screen looks the same on web, iOS and Android.

## Install

```yaml
dependencies:
  kashi_ui: ^0.1.0
  kashi_list: ^0.1.0   # for KDataList
```

```dart
CupertinoApp.router(theme: kashiCupertinoTheme(), routerConfig: router);
```

`kashiCupertinoTheme()` follows the platform brightness; pass `brightness:` to force one.

## Tokens

- Colours: `final c = KColors.of(context);` then `c.surface`, `c.surfaceRaised`, `c.ink`, `c.inkMuted`, `c.border`, `c.borderStrong`, `c.saffron`, `c.saffronSoft`, `c.saffronStrong`, `c.terracotta`, `c.sage`, `c.danger`.
- Spacing: `KSpace.s2` (8), `s4` (16), `s6` (24), `s8` (32). Radii: `KRadius.smAll`, `mdAll`, `lgAll`.
- Text: `KText.display`, `title`, `heading`, `body`, `bodySm`, `label`, `code`. They carry no colour: `KText.body.copyWith(color: c.ink)`.
- Icons: `KIcons.search`, `close`, `more`, `add`, `back`, `settings`, `filter`, `share`, `edit`, `delete`, `notifications`, `check` (the web uses the matching Lucide icons).

Never hard-code colours or font sizes in screens. Colours come from `KColors.of(context)` so dark mode works.

## Widgets

| Widget | Use |
|---|---|
| `KButton(label:, onPressed:, variant:, size:, icon:, loading:, expand:)` | actions; one `primary` per screen; `destructive` only for irreversible actions |
| `KIconButton(icon:, label:, onPressed:)` | icon-only actions; `label` is the accessibility label |
| `showKActionMenu(context, actions: [KMenuAction(...)])` | "More" menus, as an iOS action sheet |
| `KTextField(label:, controller:, hint:, errorText:)` | text input with a visible label and error |
| `KSelect`, `KRadioGroup`, `KCheckbox`, `KSwitch` | choosing values; Switch applies immediately, Checkbox is submitted |
| `KCard(title:, description:, child:)` | grouping |
| `KBadge('Label', variant:)`, `KAlert(title:, message:, variant:)` | status; always icon or text, never colour alone |

Form errors: map `ApiFailure.field('name')` from `kashi_core` into `KTextField(errorText:)`.

## Lists

For any list backed by a kashi keyset endpoint use `KDataList` with a `KDirectoryController` (`templates/list_screen.dart`). It gives search (debounced), a sort sheet, pull-to-refresh, infinite scroll, and loading, empty and error states. `sortOptions` keys must match the API's sort allowlist. Rows are at least 44pt tall.

## Rebranding

Fork the colour values in `KColors.light` / `KColors.dark` only through the tokens pipeline (edit `tokens.json` upstream, or subclass in the app for a one-off brand). Keep contrast: ink on surface 7:1, text on saffron 4.5:1, control borders 3:1.

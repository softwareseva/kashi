# @softwareseva/tokens

Single source of truth for kashi design tokens: colors (light + dark), spacing, radii, type scale, and the icon name map. Private, unversioned (`0.0.0`) — this package is never published; it exists so `tokens.json` has one canonical location to edit.

`tokens.json` ships the default **kaushik** theme (warm paper surfaces, saffron brand). Every consumer mirrors it:

- `packages/ui/src/kashi.css` — CSS variables for `@softwareseva/ui` (`:root` for light, `.dark` for dark)
- `dart/kashi_ui/lib/src/tokens.dart` — the same values as Dart constants for `kashi_ui`

## Editing a token

1. Edit `packages/tokens/tokens.json` first.
2. Mirror the change into `packages/ui/src/kashi.css` and `dart/kashi_ui/lib/src/tokens.dart`.
3. Run `pnpm run check:tokens` (or `node packages/tokens/check-tokens.mjs`) — it fails if the CSS or Dart values disagree with `tokens.json`, resolving `var(--x)` aliases in the CSS along the way.

To rebrand instead of editing the shared tokens, override CSS variables in your own app (see the `kashi-ui-web` skill) or Dart theme (see `kashi-ui-flutter`) rather than changing this package.

See the `kashi-ui-web` and `kashi-ui-flutter` skills for how these tokens map onto components.

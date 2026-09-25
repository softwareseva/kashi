# @kashi/ui

Accessible React primitives on Tailwind v4, themed by CSS variables. Ships the default **kaushik** theme (warm paper surfaces, saffron brand) with light and dark modes. Override any `--token` in your own CSS to rebrand.

## Install

```bash
pnpm add @kashi/ui react react-dom tailwindcss lucide-react class-variance-authority clsx tailwind-merge \
  @radix-ui/react-slot @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-radio-group \
  @radix-ui/react-checkbox @radix-ui/react-switch
```

In your app CSS (the order matters, and the `@source` line is required or Tailwind will not generate the classes used inside the package):

```css
@import "@kashi/ui/fonts.css";   /* optional; must come first */
@import "tailwindcss";
@import "@kashi/ui/kashi.css";
@source "../node_modules/@kashi/ui/dist";
```

Dark mode: add the `dark` class to `<html>`.

## Components

Button, IconButton, DropdownMenu, Input + Field, Select, RadioGroup + RadioOption, Checkbox, Switch, Card, Badge, Alert. See the `kashi-ui-web` skill for usage rules.

## Theming

Every colour is a CSS variable on `:root` and `.dark` (`--surface`, `--ink`, `--saffron`, ...), mapped onto the shadcn names (`--primary`, `--background`, ...) so stock shadcn components pick up the brand too. Redefine the variables after the import to change the theme.

---
name: kashi-ui-web
description: Style a React app with @softwareseva/ui on Tailwind v4, covering install, the CSS import order and @source lines, light and dark mode, theming by overriding CSS variables, and the primitives (Button, IconButton, DropdownMenu, Input with Field, Select, RadioGroup, Checkbox, Switch, Card, Badge, Alert). Use when starting a web UI, adding a form or dialog, choosing a component or variant, rebranding colours, or when Tailwind classes from kashi packages are missing.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/ui@0.1"
---

# kashi UI on the web

`@softwareseva/ui` is a set of accessible primitives (Radix + Tailwind v4 + class-variance-authority) themed entirely by CSS variables. The default theme is **kaushik**: warm paper surfaces, ink text, saffron brand, terracotta links, light and dark. `kashi_ui` is the same design in Flutter.

## Install

1. `pnpm add @softwareseva/ui` plus peers: `react react-dom tailwindcss @tailwindcss/vite lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-radio-group @radix-ui/react-checkbox @radix-ui/react-switch`.
2. Vite: add `@tailwindcss/vite` to plugins.
3. `src/index.css` exactly in this order (`templates/index.css`):

```css
@import "@softwareseva/ui/fonts.css";      /* optional; @import rules must come first */
@import "tailwindcss";
@import "@softwareseva/ui/kashi.css";
@source "../node_modules/@softwareseva/ui/dist";
@source "../node_modules/@softwareseva/list/dist/react";   /* if you use @softwareseva/list/react */
@source "../node_modules/@softwareseva/auth/dist/react";   /* if you use @softwareseva/auth/react */
```

Without the `@source` lines Tailwind never sees the classes used inside the packages and components render unstyled. This is the most common setup bug.

4. Dark mode: toggle the `dark` class on `<html>` (`templates/theme-toggle.tsx` follows the OS and remembers a choice).

## Rules

- Use tokens, never raw colours: `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-muted`, `border-border`, `border-border-strong`, `bg-saffron`, `bg-saffron-soft`, `text-terracotta`, `text-sage`, `text-danger`. shadcn names (`bg-primary`, `text-muted-foreground`, `border-input`) map onto them, so stock shadcn components also match.
- Type scale utilities: `text-display`, `text-title`, `text-heading`, `text-body`, `text-body-sm`, `text-label`, `text-code`.
- Saffron is a fill, not a text colour on light surfaces (contrast). Links and text emphasis use terracotta.
- One primary Button per screen. `destructive` only for irreversible actions, with a confirmation.
- Every IconButton has a `label` (it becomes `aria-label` and the tooltip).
- Every input sits in a `Field` with a visible label; errors go in `Field error=` so they are announced.
- Status is never colour alone: Alert and Badge variants pair colour with an icon or text.
- Touch targets at least 40px (`md` buttons are 40px, `lg` 48px). Keep visible focus rings.

Component props and when to use which: `references/components.md`.

## Theming

Override variables after the import. Change the brand in one place:

```css
@import "@softwareseva/ui/kashi.css";
:root { --saffron: #2563eb; --saffron-soft: #dbeafe; --saffron-strong: #1d4ed8; --terracotta: #1d4ed8; --focus-ring: #1d4ed8; }
.dark { --saffron: #60a5fa; --saffron-soft: #1e3a5f; --saffron-strong: #60a5fa; --terracotta: #93c5fd; --focus-ring: #60a5fa; }
```

Keep contrast: `--ink` on `--surface` at least 7:1, `--on-saffron` on `--saffron` at least 4.5:1, `--border-strong` on surfaces at least 3:1. The token source of truth for the default theme is `tokens.json` in the kashi repo; the Flutter package mirrors it.

## Updating

`pnpm up @softwareseva/ui` restyles every screen that uses the primitives. Local overrides in your CSS survive updates. Do not copy component source into the app; if a component needs a new variant, add it upstream or wrap it.

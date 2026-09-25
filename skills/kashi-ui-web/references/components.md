# @softwareseva/ui components

| Component | Use for | Key props |
|---|---|---|
| `Button` | actions | `variant`: primary, secondary, outline, ghost, destructive, link; `size`: sm, md, lg, icon, icon-sm; `asChild` to style a router `Link` |
| `IconButton` | icon-only actions (search, close, more) | `label` (required), `icon`, `variant`: ghost, outline, secondary, primary; `size`: sm, md |
| `DropdownMenu` + `Trigger`, `Content`, `Item`, `Separator`, `Group` | action menus from a "More" button | `DropdownMenuItem destructive` |
| `Input` | single-line text | `invalid` |
| `Field` | label + control + hint or error | `id`, `label`, `hint`, `error`; wraps one `Input` |
| `Select` + `Trigger`, `Value`, `Content`, `Item`, `Label`, `Group` | picking one value from a list | Radix Select API |
| `RadioGroup` + `RadioGroupItem`, `RadioOption` | one of a few visible options | `RadioOption value label description` |
| `Checkbox` | a choice submitted with a form | Radix Checkbox API |
| `Switch` | an on/off setting that applies immediately | Radix Switch API |
| `Card` + `Header`, `Title`, `Description`, `Content`, `Footer` | grouping related content | |
| `Badge` | short status labels | `variant`: neutral, brand, success, danger |
| `Alert` | inline messages | `variant`: info, success, danger; `title`; `icon` (a Lucide element) |
| `cn` | merge class names | `cn("px-4", condition && "bg-surface")` |

Related packages built on these:

- `@softwareseva/list/react`: `DataTable`, `DirectoryToolbar`, `CursorPagination` (see `react-data-table`).
- `@softwareseva/auth/react`: `SignIn`, `OtpSignIn`, `PasskeyButton`, `OAuthButton`, `PasswordSignIn` (see `api-client-react`).

Choosing:

- Select vs RadioGroup: up to 5 options that benefit from being visible, RadioGroup; otherwise Select.
- Checkbox vs Switch: Checkbox when the value is saved by a submit button; Switch when it takes effect immediately.
- DropdownMenu vs Select: menus run actions; selects choose values.

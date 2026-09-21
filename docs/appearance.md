# Appearance

The toolbar settings offer **System**, **Light**, and **Dark**. System is the default and follows
changes to the device's color scheme while the extension is open. Explicit Light/Dark choices
override the system. The validated `theme` setting is saved in `browser.storage.local`, so open
tabs and the toolbar popup update together. Removing the key restores System.

## Shared design tokens

`src/content.css` defines tokens on `:host` and `:root`. Light overrides the color tokens with
`data-keymove-theme="light"`; dark uses the base palette. `useTheme` resolves System before
painting and subscribes to `prefers-color-scheme` changes. In content scripts it targets the
owned Shadow DOM host, which also supplies portal and modal content. The host page's theme
is never changed. Page highlights retain the user's separately chosen highlight colors.

| Family | Purpose |
| --- | --- |
| `--keymove-surface*`, `--keymove-popup-surface` | Searchbar, help, error and popup surfaces |
| `--keymove-text-*`, `--keymove-border*`, `--keymove-focus` | Text hierarchy, separation and keyboard focus |
| `--keymove-control-*`, `--keymove-selected`, badge and match tokens | Control and search-result states |
| `--keymove-space-1` through `--keymove-space-6` | Shared 4, 8, 12, 16, 20 and 24px spacing |
| `--keymove-radius-*` | Badge, small control, control, button and surface corners |
| `--keymove-font-*`, `--keymove-line-height` | Shared interface font, text sizes and line height |
| `--keymove-setting-control`, `--keymove-setting-gap` | One grid for settings controls and labels |
| `--keymove-settings-column` | Popup's 130px right column; checkboxes, number and color inputs center within it |

Every `var()` use must include a literal fallback. The CSS regression covers both shared and
popup styles. Tokens represent reusable visual decisions; runtime geometry, selection outlines
and user-chosen highlight colors keep their existing calculations. Adding another theme must
not duplicate component markup or create a parallel set of layout rules.

## Rendered checks

Run `yarn preview:ui` and open `?scenario=theme-settings` to switch themes on the shared settings
components, including all four settings tabs and example site overrides (preview only).
The popup retains its tabs and compact footer while long tab contents scroll, bounded to
the browser's 600px popup height. Other scenarios accept `&theme=light`, `&theme=dark`, or `&theme=system`.
Inspect `slate-above`, `slate-below`, `action-menu-narrow`, and keyboard help at desktop and
narrow widths. `&browser=firefox` previews that surface's opacity; it is not a Firefox runtime test.

Browser smoke checks settings alignment and viewport fit at 1280px and 360px, captures both
themes, and checks actual extension storage propagation, reload persistence and live system
changes. Images are saved in `.artifacts/`. Keep visual inspection as well as geometry assertions:
an aligned component can still have the wrong color, type or transparency.

# Theming

All colour, radius, density and surface decisions are CSS variables in `app/globals.css`, switched by a class (`.dark`) and four data attributes on `<html>`. Components never hard-code colours; they use Tailwind utilities bound to the tokens.

## Tokens

`app/globals.css` declares the Tailwind v4 theme with `@theme inline` and a `dark` custom variant (`@custom-variant dark (&:is(.dark *))`). Values are OKLCH except the chart palette, which is hex.

Beyond the shadcn defaults (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--sidebar-*`, `--radius`), the template adds:

| Token | Purpose |
| --- | --- |
| `--brand`, `--brand-foreground` | Product accent used for the progress tone, LLM nodes, agent chips. Overridden by accent presets. |
| `--success`, `--success-foreground`, `--success-text` | Healthy, passed, approved. `text-success-foreground` is the text on `bg-success`. |
| `--warning`, `--warning-foreground`, `--warning-text` | At risk, pending, degraded |
| `--info`, `--info-foreground`, `--info-text` | Informational states, redactions |
| `--destructive`, `--destructive-foreground`, `--danger-text` | Destructive buttons and badges; `text-destructive-foreground` is the text on `bg-destructive`, `text-danger-text` is readable red text on the tinted background |
| `--chart-1` to `--chart-8` | Categorical chart palette, colour-blind safe, validated for light and dark. 1 to 5 are the main series; 6 (governance green), 7 (violet) and 8 (red) extend it for the readiness domains and multi-series charts. Do not cycle past 8. |

The `*-text` variants are tuned for 4.5:1 contrast on their tinted backgrounds in both modes; `StateBadge` uses them. Light values are in `:root`, dark values in `.dark`. Rules that follow from the tokens: never `text-white` on a coloured background (use the matching `*-foreground`), use `text-danger-text` / `text-info-text` rather than `text-destructive` / `text-info` for text, and never a palette class such as `text-red-500` or `bg-green-100`. Tones for states come from `toneClasses` and `stateTone` in `components/shared/status-badge.tsx`.

### Type scale additions

Two steps below `text-xs` exist for pills, eyebrows and dense table meta: `text-2xs` (0.6875rem, line height 1rem) and `text-3xs` (0.625rem, line height 0.875rem). They replace the arbitrary `text-[11px]` and `text-[10px]` values; `CountPill` uses both sizes.

### Eyebrow utilities

`@utility eyebrow` and `@utility eyebrow-mono` set the size (`--text-2xs`), weight, tracking, transform and muted colour for the small uppercase labels above titles and sections. The `Eyebrow` component in `components/shared/eyebrow.tsx` applies them (`mono` picks the monospace variant used on error and 404 pages); do not write the classes by hand.

## Light, dark and system

`components/theme-provider.tsx` wraps `next-themes` with `attribute="class"`, `defaultTheme="system"` and `enableSystem`. `<html suppressHydrationWarning>` is required. The provider also:

- exposes `withThemeTransition`, which the **D** hotkey in `components/layout/command-menu.tsx` calls to toggle dark mode (the hotkey follows the shared keyboard contract: ignored while typing, inside dialogs, sheets, menus and the assistant panel, and when a page handler has called `event.preventDefault()`);
- adds `html.theme-transition` for 320 ms around a flip so surfaces cross-fade together (`withThemeTransition`), skipped when the user prefers reduced motion;
- catches external theme changes (system preference, another tab) and animates them too, except the very first resolution.

## Customizer

The paintbrush in the header opens `ThemeCustomizer`. Options come from `lib/theme-presets.ts`:

| Dimension | Ids | Applied as |
| --- | --- | --- |
| Accent | neutral, ocean, violet, emerald, rose, amber, teal | `data-accent` on `<html>`; CSS overrides `--primary`, `--primary-foreground`, `--ring`, `--brand`, `--sidebar-primary`, `--chart-1` for light and `.dark` |
| Radius | none (0), sm (0.375rem), md (0.625rem), lg (0.875rem), xl (1.25rem) | `data-radius`, sets `--radius` |
| Density | comfortable, compact | `data-density`; compact tightens tables, cards and titles through `[data-slot]` selectors |
| Surface | flat, elevated | `data-surface`; elevated adds soft shadows to cards, popovers, dialogs, sheets and the inset sidebar |
| Sidebar | inset, sidebar (classic), floating | prop on `AppSidebar`, passed from `CustomizerProvider` through `AppFrame` |

Six one-click style presets (`stylePresets`) combine them:

| Preset | Accent | Radius | Density | Surface | Sidebar |
| --- | --- | --- | --- | --- | --- |
| Nova | neutral (shadcn default) | md | comfortable | flat | inset |
| Console | ocean | sm (subtle) | compact | flat | sidebar (classic) |
| Aurora | violet | lg (soft) | comfortable | elevated | floating |
| Forest | emerald | md | comfortable | elevated | sidebar (classic) |
| Ember | amber | xl (round) | comfortable | elevated | inset |
| Slate | teal | sm (subtle) | compact | elevated | inset |

Settings persist in `localStorage` under `agentops:theme`. `sanitizeThemeSettings` drops unknown keys and values, and `themeInitScript` (inlined in `app/layout.tsx` `<head>`) applies the attributes before first paint so there is no flash. Light and dark are not in this script; `next-themes` handles them with its own inline script.

## Rebranding

To rebrand permanently rather than through the customizer:

1. Change `--brand` and `--brand-foreground` in `:root` and `.dark`.
2. Change `--primary`, `--primary-foreground`, `--ring` and `--sidebar-primary` in the same two blocks if the primary button and focus ring should follow.
3. Optionally change the default accent in `defaultThemeSettings` so the customizer's "default" matches.
4. Leave `--chart-1` to `--chart-8` alone unless you re-validate the palette for contrast and colour-blindness in both modes; the accent presets intentionally override only `--chart-1`.
5. Fonts are Geist and Geist Mono from `next/font/google` in `app/layout.tsx`, exposed as `--font-sans` and `--font-mono`.
6. Replace `public/favicon.svg` and `app/favicon.ico`; `app/layout.tsx` metadata references both and takes name, description and tagline from `config/site.ts`.

Nothing in `components/` or `features/` needs to change.

## Adding an accent

1. Add an entry to `accents` in `lib/theme-presets.ts` with `id`, `label`, `description`, `swatch` and `swatchDark`.
2. Add `[data-accent="<id>"]` and `.dark[data-accent="<id>"]` blocks in `globals.css` following the existing ones.
3. The id set used by `sanitizeThemeSettings` and `themeInitScript` is derived from the array, so no other change is needed.

## Status colours

Lifecycle states map to tones (neutral, info, progress, warning, success, danger, muted) in `stateTone` in `components/shared/status-badge.tsx`. Add new state strings there; do not colour states in pages. `StatusDot` takes a `label` for the accessible name.

## Charts

Use `components/charts/` and `var(--chart-n)` with n from 1 to 8. The chart wrappers read the tokens, so a theme change recolours every chart. Heights come from `CHART_HEIGHT` (`sm` 180, `md` 240, `lg` 280) in `components/charts/chart-primitives.tsx`. No dual axes; show a legend for two or more series.

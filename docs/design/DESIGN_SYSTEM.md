# SMMAHUB Design System

Phase 1 establishes a restrained, editorial SaaS system for agency owners who need the product to feel calm, premium, and safe to show to clients. The default experience is dark, with an equally intentional light theme.

## Design Principles

- Calm control: prioritize hierarchy, scan speed, and quiet confidence over decoration.
- Governed AI: use the brand accent for approval, focus, and system confidence, not for every graphic.
- Dense where useful: marketing pages can breathe; app screens should be compact, legible, and task-oriented.
- No surprise motion: transitions are fast, purposeful, and disabled for reduced-motion users.

## Typography

Fonts are loaded from Google Fonts in `src/index.css`.

- Display and headings: `Manrope`. Used for hero headlines, page titles, card titles, and navigation identity.
- Body and UI: `IBM Plex Sans`. Used for controls, descriptions, forms, tables, and application text.
- Numeric data: same UI font with `font-variant-numeric: tabular-nums`.

Scale:

- Display: mobile `3rem`, desktop `6rem`, line-height `0.95`, weight `700`.
- H1: mobile `2.25rem`, desktop `4.5rem`, line-height `1`, weight `700`.
- H2: mobile `1.875rem`, desktop `3rem`, line-height `1.05`, weight `700`.
- H3: `1.25rem`, line-height `1.2`, weight `650`.
- Body: `1rem`, line-height `1.65`, weight `400`.
- UI: `0.875rem`, line-height `1.45`, weight `500`.
- Label: `0.75rem`, line-height `1.35`, weight `650`, letter spacing `0.08em`.

Letter spacing stays at `0` except small labels, which use positive tracking.

## Color Tokens

Dark theme:

- `background`: `#070807`
- `foreground`: `#F4F1EA`
- `card`: `#10110F`
- `surface`: `#151612`
- `muted-bg`: `#1C1D18`
- `border`: `#2A2B24`
- `muted-foreground`: `#A9A394`
- `primary`: `#D7B46A`
- `primary-hover`: `#E2C57F`
- `accent`: `#A7C6A1`
- `success`: `#72C48F`
- `warning`: `#E0B15E`
- `destructive`: `#DE6A5F`
- `info`: `#8DB7D8`

Light theme:

- `background`: `#F7F3EA`
- `foreground`: `#191A16`
- `card`: `#FFFDF7`
- `surface`: `#EFEBE0`
- `muted-bg`: `#E7E1D3`
- `border`: `#D8CFBD`
- `muted-foreground`: `#665F51`
- `primary`: `#8A641E`
- `primary-hover`: `#725017`
- `accent`: `#486B47`
- Semantic colors mirror the dark theme with adjusted foreground tokens.

Usage:

- Gold is the only primary brand action color. Use it for primary CTAs, focus, selected states, approval confidence, and important metrics.
- Sage is supportive. Use it for calm system surfaces and secondary confidence states.
- Semantic colors are reserved for real status meaning.
- Avoid purple/blue gradients and rainbow surfaces.

## Surfaces

- Page backgrounds use layered radial fields plus subtle noise through `body::before`.
- Primary cards use `bg-card`, `border-border`, `shadow-card`, and `rounded-lg`.
- Elevated panels use `shadow-panel` and a soft inset highlight.
- App shell surfaces use transparent layered panels, not flat black blocks.

Radii:

- `sm`: `0.375rem`
- `md`: `0.625rem`
- `lg`: `0.875rem`
- `xl`: `1.25rem`
- `2xl`: `1.75rem`

## Motion

- Fast: `150ms`
- Standard: `200ms`
- Slow: `280ms`
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`

Rules:

- Use opacity and transform for motion.
- Hover movement is limited to `translateY(-1px)` or a subtle scale.
- Respect `prefers-reduced-motion`.

## Components

Button:

- `default`: primary gold filled, used for the main action only.
- `secondary`: quiet filled surface.
- `outline`: bordered surface for secondary actions.
- `ghost`: navigation and low-emphasis controls.
- `destructive`: reserved for irreversible actions.
- All buttons include hover, active, disabled, and focus-visible states.

Card:

- Default cards are bordered, softly raised, and non-scaling.
- Card hover is subtle and should not imply clickability unless the card is interactive.

Inputs:

- Inputs use the surface token, visible borders, 44px mobile hit areas, strong focus rings, and muted placeholders.

Dialogs and sheets:

- Darkened overlay with blur.
- Content uses elevated card tokens and a visible close target.
- Mobile dialogs become bottom sheets.

Tabs:

- Segmented control surface with active state using card + primary text.

Badge:

- Compact, low-radius pills. Semantic variants use tokenized status colors.

Tables:

- Header labels are muted and compact.
- Rows use soft hover backgrounds and stable tabular figures.

EmptyState:

- Deterministic icon surface, concise title, specific next action. No random colors.

Skeleton:

- Subtle shimmer aligned to the neutral ramp.

## Layout Patterns

- Public pages use max-width `1280px` with generous vertical rhythm.
- App pages use max-width `1440px` and task-dense cards.
- Dashboard sections follow: page header, KPI strip, action queue, operational panels.
- Mobile app shell preserves bottom navigation and avoids horizontal overflow.

## Accessibility

- Contrast targets WCAG AA in both themes.
- Focus rings are visible across buttons, links, inputs, menus, dialogs, tabs, and sidebar controls.
- Icon-only buttons require screen-reader text or aria labels.
- Motion is disabled under reduced-motion preference.

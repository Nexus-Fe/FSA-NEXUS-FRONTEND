---
version: alpha
name: Nexus Marketplace & Operations Design System
description: Deep Burgundy, Alabaster, and Frosted Cream Glass UI system across Public/Buyer, Seller, Staff, and Admin portals, anchored to /admin/withdrawals and src/styles/theme.css.
colors:
  primary: "#6e1e2b"
  primary-hover: "#541520"
  primary-active: "#3d0e17"
  primary-soft: "#f5e9eb"
  primary-border: "#c49099"
  primary-accent: "#b98b93"
  primary-accent-light: "#f7f1e8"
  forest-mid: "#3a1720"
  hero-bg-deep: "#18181b"
  ink: "#1f2024"
  muted: "#5e5a58"
  canvas: "#f4efe6"
  page-bg: "#F2F1EB"
  surface: "rgba(253, 250, 245, 0.94)"
  line: "#e2d9cc"
  glass-border: "rgba(255, 255, 255, 0.88)"
  red: "#dc2626"
  red-dark: "#b91c1c"
  red-soft: "#fef2f2"
  green: "#16a34a"
  green-soft: "#f0fdf4"
  amber: "#d97706"
  amber-soft: "#fffbeb"
  indigo: "#4f46e5"
typography:
  sans:
    fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif"
  display:
    fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif"
    fontSize: "34px"
    lineHeight: "1.2"
    fontWeight: "760"
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif"
    fontSize: "20px"
    lineHeight: "1.3"
    fontWeight: "700"
  body:
    fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: "1.6"
    fontWeight: "400"
  table-header:
    fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif"
    fontSize: "11px"
    lineHeight: "1.35"
    fontWeight: "700"
    letterSpacing: "0.05em"
rounded:
  control: "11px"
  button: "8px"
  pill: "999px"
  card-base: "12px"
  card-glass: "20px"
  hero: "26px"
  modal: "16px"
spacing:
  page-grid: "56px"
  portal-padding-x: "36px"
  portal-padding-y: "32px"
  card-padding: "24px"
  stack-gap: "20px"
  table-cell-x: "18px"
  table-cell-y: "15px"
  grid-gap: "18px"
components:
  card:
    radius: "{rounded.card-glass}"
    border: "{colors.glass-border}"
    surface: "{colors.surface}"
  button-primary:
    radius: "{rounded.button}"
    background: "{colors.primary}"
    color: "#ffffff"
  filter-bar:
    radius: "{rounded.pill}"
    active-background: "{colors.hero-bg-deep}"
---

## Overview

Nexus is a multi-role marketplace and auction web application with four portals that share one visual system. Public and Buyer routes use a top-navigation marketplace shell. Seller, Staff, and Admin routes use a left-sidebar operations shell modeled on `/admin/withdrawals`.

## Colors

CSS custom properties in `src/styles/theme.css` define all brand and surface colors. Components read these tokens directly so theme updates stay in one place.

| Role | Tokens | Where they apply |
| :--- | :--- | :--- |
| Brand | `primary`, `primary-hover`, `primary-active`, `primary-soft`, `primary-border` | Primary buttons, active navigation states, focus highlights, and soft badges |
| Surfaces | `page-bg`, `canvas`, `surface`, `glass-surface`, `glass-border`, `line` | Page backdrop, cards, frosted containers, table dividers, and image box frames |
| Text | `ink`, `muted` | Primary copy, secondary labels, and placeholders |
| Status | `green`, `amber`, `red`, `indigo` | Operational statuses, wallet balances, warnings, and destructive confirmations |

`src/styles/theme.css` also exposes `--border` (`var(--line)`) and `--surface-muted` (`var(--canvas)`) as compatibility aliases so image frames and inline dividers never lose their border.

## Typography

All portals load `Plus Jakarta Sans` through `next/font/google` and bind it to `--font-ui`.

- Numeric columns, prices, balances, countdowns, and pagination counters set `font-variant-numeric: tabular-nums` so numbers align vertically.
- Inside `.portal-main`, `PageHeading` renders a single title line and hides overlines and lead descriptions to leave more vertical space for tables.
- On marketplace pages, `PageHeading` renders inside the dark gradient hero header with white display text and light cream subtext.

## Layout

### Marketplace shell (Public and Buyer)

- The sticky header (`buyer-header`) holds the brand mark, global search pill (`border-radius: 999px`), portal links, `36px` action pills for Orders and Cart (`.header-action-pill`), `NotificationBell`, and `AccountMenu`.
- The floating glass navigation bar (`buyer-nav-wrap`) wraps items onto multiple lines when needed (`border-radius: 28px`), animates the dark active pill (`fluid-nav-indicator`), and opens the category mega-menu on hover or focus.
- Content sits inside `.buyer-main` (`max-width: 1800px`) with `Breadcrumbs` above and `SiteFooter` below.

### Operations portal shell (Seller, Staff, and Admin)

- The sticky `260px` left sidebar (`portal-sidebar`) contains `Brand`, the role pill, collapsible navigation groups (`NavLinks` using `NavigationSection[]`), and the bottom `PortalAccountMenu`.
- Below `780px`, `.mobile-menu` replaces the fixed sidebar with a collapsible header drawer holding the same grouped links and account menu.
- The fluid content column (`.portal-main`, `max-width: 1600px`) uses `.page-stack` (`gap: 20px`) and direct-child block spacing (`20px` between cards, `.split` grids, action bars, and alert banners inside `.portal-main` and `.auction-surface`).

## Elevation and depth

`body::before` and `body::after` in `src/styles/theme.css` draw the shared alabaster grid, radial corner glows, and grain texture once behind every page. Inner containers stay transparent or frosted, without opaque slate fills (`#f1f5f9`, `#eff4ff`).

Operations cards (`.portal-shell-operations .portal-main .card`) and Buyer glass cards use frosted backgrounds with `1px` top/outer highlights and soft shadows. Popovers (`RowActionsMenu`, `AccountMenu`, `NotificationBell`, `SelectBox`) and `Modal` dialogs stack above sticky headers and sticky table columns via explicit z-index layers.

## Shapes and clipping

| Element | Radius | Notes |
| :--- | :--- | :--- |
| Glass cards, `.route-state`, `.access-state` | `20px` | Standard container radius across all four portals |
| Hero banners | `26px` | Marketplace `PageHeading` headers |
| Modals and feedback banners | `16px` | `.modal-panel`, `.admin-modal`, `.notice`, `.form-error`, `.form-success`, `.state-error` (with `16px` outer margin inside `<Card>`) |
| Inputs and selects | `11px` | `.field`, `.select-field`, `.textarea-field` |
| Standard buttons | `8px` | `.button` |
| Pills, badges, choice bars | `999px` | `FluidChoiceBar`, `.badge`, `.header-action-pill`, search bar |

Any `<Card>` wrapping `.table-scroll`, `.data-table`, `.cart-select-all`, `.cart-seller-group`, or `.admin-pagination-bar` clips inner corners (`overflow: hidden` on `.card`, `border-radius: inherit` on flush `.table-scroll` wrappers, and no bottom border on the final table row) so table headers and row lines stay inside the rounded card frame.

## Components

### Cards and data tables

Top-level list tables sit directly inside `<Card>` (without `.card-pad` around the table) followed by `<AdminPagination>` as the card footer. Filter forms or inline action panels above a table sit inside a separate `<Card className="card-pad">` spaced `20px` above the table card, or inside `.toolbar` at the top of the table card. Row actions use `RowActionsMenu` (one primary action button plus an overflow menu) so buttons do not wrap inside table cells.

### Filter and tab bars

Single-axis status filters and content tabs use `FluidChoiceBar` (`mode="filter"` or `mode="tabs"`). Multi-field search, date, and select filters use `.ops-filters` inside `<Card className="card-pad">` with `42px` control heights.

### Portal sidebar navigation

Seller, Staff, and Admin sidebars share `NavigationSection[]` (`item` and collapsible `group` entries) rendered by `NavLinks`. Active groups expand automatically, chevrons rotate on open, and each link uses a matching `IconName` from `src/components/ui/Icon.tsx`.

### Image thumbnails and evidence grids

Product thumbnails and evidence galleries in operational tables and detail modals use `ThumbnailBox` (`src/components/ui/BackendImage.tsx`), `EvidenceThumbnailGrid` (`src/components/ui/ImageLightbox.tsx`), and `.auction-ops-detail-image`. Each frame uses a `1px solid var(--line)` border and `var(--canvas)` background so thumbnails separate clearly from the card surface.

### Form controls, modals, and text overflow

`field`, `select-field`, `textarea-field`, `SelectBox`, and `DatePicker` share unified borders, radii, focus outlines, and `aria-invalid` error states. Confirmations and detail dialogs use `Modal` and `ConfirmDialog` with focus trapping and Escape handling.

Long single-line titles, breadcrumbs, shop names, emails, and table cell values use `TruncatedText` (`src/components/ui/TruncatedText.tsx`). It truncates overflowing text with an ellipsis and uses `ResizeObserver` to show a `"..."` trigger pill that opens a portaled popover (`z-index: 1300`) without activating parent links or clickable rows.

## Guidelines

### Preferred patterns

- Read color and surface tokens from `src/styles/theme.css` (`--primary`, `--primary-soft`, `--surface`, `--glass-surface`, `--glass-border`, `--line`, `--ink`, `--muted`) in CSS rules and TSX styles.
- Keep `.table-scroll` and `.data-table` corners clipped inside `<Card>` and omit the final row's bottom border when flush against the card edge.
- Apply `.portal-shell-operations` and `.page-stack` consistently across Seller, Staff, and Admin routes so cards, spacing, tables, pagination, and sidebars match.
- Use `ThumbnailBox` or `EvidenceThumbnailGrid` for operational image previews so borders and fallbacks stay consistent.

### Avoid

- Legacy sky-blue, lime, or green-tint hex literals (`#eff4ff`, `#7dd3fc`, `#0284c7`, `#e0f2fe`, `#c8e71f`, `#f8fdff`, `#f8fbff`, `rgba(245, 252, 247, .7)`) in stylesheets or feature components.
- Rendering `.table-scroll` tables outside `<Card>`, or mixing `12px` card radii with `20px` glass cards on the same screen.
- Stacking cards inside `.portal-main` or `.page-stack` with ad-hoc `marginBottom: 16` overrides that conflict with the `20px` stack spacing.
- Reusing generic sidebar icons across distinct operational pages when specific icons exist in `src/components/ui/Icon.tsx`.

---
version: alpha
name: Nexus Marketplace & Operations Design System
description: Canonical Deep Burgundy, Alabaster, and Frosted Cream Glass UI system across Public/Buyer, Seller, Staff, and Admin portals, anchored to /admin/withdrawals and src/styles/theme.css.
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

Nexus is a multi-role commerce and auction web application with four user experiences sharing one Deep Burgundy, Alabaster, and Frosted Cream Glass visual language. Public and Buyer pages run inside a top-navigation marketplace shell, while Seller, Staff, and Admin portals run inside a unified left-sidebar operations shell anchored to the `/admin/withdrawals` reference layout.

## Colors

Brand and surface colors are governed centrally by CSS custom properties in `src/styles/theme.css`. Components consume semantic tokens rather than inline hex literals.

- Primary brand actions, active navigation states, and key highlights use `primary`, `primary-hover`, `primary-active`, `primary-soft`, and `primary-border`.
- Page backdrop layers use `page-bg` with subtle crimson grid lines, warm corner radial glows, and paper grain rendered behind all shells.
- Frosted content panels use `surface` or the translucent glass gradient bounded by `glass-border` and `line`.
- Semantic status feedback (`green`, `amber`, `red`, `indigo`) is reserved strictly for operational states, balances, warnings, and destructive confirmations.

## Typography

All interfaces use `Plus Jakarta Sans` loaded via `next/font/google` and bound to `--font-ui`.

- Numeric quantities, prices, balances, countdowns, and pagination counters use `font-variant-numeric: tabular-nums` so columns align vertically.
- Portal `PageHeading` displays a clean single title line inside `.portal-main` (overlines and redundant lead descriptions are suppressed in dashboard views to preserve above-the-fold table space).
- Marketplace `PageHeading` renders inside the dark gradient hero banner with crisp white display type and muted cream subcopy.

## Layout

### Marketplace Shell (Public & Buyer)

- Sticky top header (`buyer-header`) combining brand mark, global product/shop search bar, privileged role portal shortcuts, order/cart/notification icons, and `AccountMenu`.
- Floating pill top navigation (`buyer-nav-wrap`) with a sliding dark capsule indicator (`fluid-nav-indicator`) and hover/focus category mega-menu.
- Main content container capped at `1800px` max width (`buyer-main`) with consistent `Breadcrumbs` and compact `SiteFooter`.

### Operations Portal Shell (Seller, Staff & Admin)

- Sticky `260px` left sidebar (`portal-sidebar`) with `Brand`, role subtitle, collapsible grouped navigation (`NavLinks` consuming `NavigationSection[]`), and pinned bottom `PortalAccountMenu`.
- Responsive mobile header drawer (`mobile-menu`) below `780px` that exposes the identical grouped navigation and account menu.
- Fluid main column (`portal-main`) capped at `1600px` with `Breadcrumbs` and standardized vertical spacing between `PageHeading`, filter bars, and data cards.

## Elevation & Depth

- Ambient background depth is provided once at `body::before` and `body::after` in `src/styles/theme.css`; inner containers remain transparent or frosted rather than painting opaque slate backgrounds (`#f1f5f9`, `#eff4ff`).
- Operations cards (`.portal-shell-operations .portal-main .card` and Buyer glass cards) use soft glass elevation with `1px` bright top/outer bevel highlights and subtle drop shadows.
- Floating menus (`RowActionsMenu`, `AccountMenu`, `NotificationBell` popover, `SelectBox` popover) and `Modal` dialogs layer cleanly above sticky headers and table columns using explicit z-index tiers and backdrop blur.

## Shapes

- Unified rounded corner hierarchy: `20px` on all glass `<Card>` containers, `.route-state`, and `.access-state` across Buyer, Seller, Staff, and Admin; `26px` on dark hero headers; `16px` on modals, `.notice`, `.form-error`, `.notice[role="alert"]`, `.form-success`, and `.state-error` (with `16px` margin when placed directly inside `<Card>`); `11px` on form inputs/selects; `8px` on standard buttons; `999px` on `FluidChoiceBar`, badges, and navigation pills.
- Strict inner-corner clipping invariant: any `<Card>` wrapping a `.table-scroll`, `.data-table`, `.cart-select-all`, `.cart-seller-group`, or `.admin-pagination-bar` must clip inner children (`overflow: hidden` on `.card`, `border-radius: inherit` on flush `.table-scroll` wrappers, and removal of the final row `border-bottom`) so rectangular table header backgrounds and row borders never protrude past rounded card corners.

## Components

- **Card & Data Table Pattern (`/admin/withdrawals` reference):**
  - Top-level list tables sit directly inside `<Card>` (without `.card-pad` wrapping the table itself) followed by `<AdminPagination>` as the bottom card footer or clean bottom border.
  - Inline action forms or filter toolbars inside a card sit in `.card-pad` or `.toolbar` above `.table-scroll`.
  - Row actions use `RowActionsMenu` (primary CTA + overflow menu) rather than wrapping stacks of buttons inside table cells.
- **Filter & Tab Bars:**
  - Single-axis status filters and content tabs use `FluidChoiceBar` (`mode="filter"` or `mode="tabs"`).
  - Multi-field search/date/select filters use `.ops-filters` inside `<Card className="card-pad">` with consistent field height (`42px`) and aligned action buttons.
- **Portal Sidebar Grouping & Icons:**
  - Seller, Staff, and Admin sidebars use `NavigationSection[]` (`item` + collapsible `group` sections) rendered by `NavLinks` with `chevron` rotation, active-group auto-expansion, and a distinct semantic `IconName` from `src/components/ui/Icon.tsx` for every menu item.
- **Form Controls, Modals & Text Overflow (`TruncatedText`):**
  - Inputs (`field`), selects (`select-field` / `SelectBox`), textareas (`textarea-field`), and `DatePicker` share uniform border, radius, focus ring, and `aria-invalid` error styling.
  - Confirmation and detail popups use shared `Modal` / `ConfirmDialog` components with accessible focus trapping and Escape handling.
  - Long single-line titles, breadcrumbs, shop names, emails, and table cell descriptions use `TruncatedText` (`src/components/ui/TruncatedText.tsx`), which clips overflowing text to one line (`text-overflow: ellipsis`) and reveals a compact `"..."` pill trigger via `ResizeObserver` to open a portaled full-text popover (`z-index: 1300`) without triggering parent links or clickable rows.

## Do's and Don'ts

- **Do** use tokens from `src/styles/theme.css` (`--primary`, `--primary-soft`, `--surface`, `--glass-surface`, `--glass-border`, `--line`, `--ink`, `--muted`) in all CSS rules and TSX inline styles.
- **Do** clip `.table-scroll` and `.data-table` corners inside `<Card>` and omit `border-bottom` on the last table row when flush with a card edge.
- **Do** apply `.portal-shell-operations` styling to Seller, Staff, and Admin portals uniformly so all three share one card, table, pagination, and sidebar specification.
- **Don't** leave legacy sky-blue, lime, or green-tint hex literals (`#eff4ff`, `#7dd3fc`, `#0284c7`, `#e0f2fe`, `#c8e71f`, `#f8fdff`, `#f8fbff`, `rgba(245, 252, 247, .7)`) in stylesheets or feature screens.
- **Don't** render bare `.table-scroll` data tables outside `<Card>`, or mix `12px` card/cart radii with `20px` glass cards on the same surface.
- **Don't** duplicate generic sidebar icons across distinct operational pages when specific icons exist in `src/components/ui/Icon.tsx`.

# Maeil1Dok Design System

## 1. Atmosphere & Identity

Maeil1Dok feels like a quiet daily reading desk: calm, legible, and trustworthy. The signature is warm-paper restraint with deep oxblood actions, where account and reading workflows feel steady rather than flashy.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--color-bg-primary` | `#FAF8F5` | `#1a1a1a` | App background |
| Surface/secondary | `--color-bg-secondary` | `#ffffff` | `#242424` | Secondary panels |
| Surface/tertiary | `--color-bg-tertiary` | `#F1EFED` | `#2d2d2d` | Subtle section contrast |
| Surface/card | `--color-bg-card` | `#ffffff` | `#2a2a2a` | Cards, grouped rows, modal bodies |
| Text/primary | `--color-text-primary` | `#1F1A17` | `#f3f4f6` | Main copy and headings |
| Text/secondary | `--color-text-secondary` | `#6B625B` | `#d1d5db` | Supporting copy |
| Text/tertiary | `--color-text-tertiary` | `#9B928A` | `#9ca3af` | Metadata and low-emphasis text |
| Border/default | `--color-border-default` | `#E9E4DE` | `#3d3d3d` | Card and control borders |
| Border/light | `--color-border-light` | `#F5F2EE` | `#333333` | Row dividers |
| Accent/primary | `--color-accent-primary` | `#2A1111` | `#F3EEEE` | Primary actions and focus |
| Accent/hover | `--color-accent-primary-hover` | `#3A1A1A` | `#E6DCDC` | Primary hover |
| Accent/tint | `--color-accent-bg` | `#F3EEEE` | `#3A2A2A` | Soft completion and secondary actions |
| Text/inverse | `--color-text-inverse` | `#FFFFFF` | `#1F1A17` | Text on primary actions |
| Status/success, info | `--color-success`, `--color-info` | `#2A1111` | `#F3EEEE` | Confirmed and informational states |
| Status/warning | `--color-warning` | `#8A6A2E` | `#D9B36A` | Caution states |
| Reading/partial | `--color-reading-current` | `#B8862B` | `var(--color-warning)` | Partial reading progress indicators, not a new status enum |
| Status/error | `--color-error` | `#B3261E` | `#F28B82` | Destructive actions and missed reading |

### Rules

- Deep oxblood (`#2A1111`) is reserved for true actions, links, focus, and completion states.
- Text on a `#2A1111` action/background surface must be white.
- Destructive actions use `--color-error` and `--color-error-bg`, with explicit confirmation.
- One primary action per screen. Use tint, border, then text for lower emphasis.
- Dark primary actions invert to light accent with inverse text; selected soft controls use a 1.5px accent border.
- Provider colors are confined to their sign-in buttons/icons (Kakao yellow, Apple dark). Highlight swatches retain the four handoff tokens.
- `themes.css` preserves the 169 handoff declarations. Add semantic aliases only where a named v2 value is needed.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `26px` | 700 | 1.3 | `-0.6px` | Mobile greeting and signup title |
| Display/desktop | `30px` | 700 | 1.25 | `-0.8px` | Desktop greeting |
| Title | `20-22px` | 700 | 1.3 | `-0.6px` | Card titles |
| Header | `16px` | 700 | 1 | `-0.4px` | App bar |
| Heading | `15px` | 700 | 1.3 | `-0.4px` | Card section heading |
| Body | `14-15px` | 400, 600 | 1.5 | `-0.4px` | Rows and descriptions |
| Reading | `16px` (user setting preserved) | 400 | 1.75 (user setting preserved) | `-0.4px` | Scripture |
| Caption | `12px` | 500, 600 | 1.4 | `-0.4px` | Metadata |
| Micro | `11px` | 600 | 1 | `-0.4px` | Tab labels and badges |
| Stat | `24px` + `13px` unit | 700, 600 | 1 | `-0.6px` | Streak and progress |
| Stat/large | `40px` | 700 | 1 | `-1px` | Leaderboard rank |

### Font Stack

- Primary: `--font-sans` (`Pretendard Variable`, Pretendard, system UI, sans-serif).
- Reading serif: `KoPub Batang`, `RIDIBatang`, `Noto Serif KR`.

### Rules

- Account and operational screens use the sans stack for fast scanning.
- Reading surfaces may use serif typography through reading settings.
- Avoid viewport-scaled text. Use `--tracking-body: -0.4px`, `--tracking-display: -0.6px`, and `--tracking-display-lg: -0.8px`.
- Numbers use `tabular-nums`; units are smaller than values. Existing stored reading font values remain unchanged.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--screen-gutter` | `20px` | Mobile horizontal padding |
| `--card-padding` | `20px` | Card padding |
| `--appbar-height` | `52px` | Subpage header |
| `--tabbar-height` | `84px` | Standard mobile navigation, safe area included |
| `--tabbar-reader-height` | `80px` | Reader navigation, safe area included |
| `--sidebar-width` | `240px` | Desktop navigation |
| `--content-max` | `760px` | Desktop main column |
| `--aside-width` | `300px` | Desktop secondary column |
| `--hit-min` | `44px` | Minimum control hit width and height |

### Grid

- Below 1024px, use five bottom tabs: home, Bible, plan, groups, profile (login when signed out). At 1024px and above, use the sidebar.
- Mobile content is at most 768px wide; desktop uses a 760px main column plus optional 300px aside with a 28px gap and 36px/40px main padding.
- Section gaps are 14px on lists and 20px on home; grids use 8px gaps. List rows are at least 56px tall, with 10-14px vertical and 18-20px horizontal padding.
- Hit areas are at least 44px in both dimensions. Navigation owns the safe-area inset once, including reader density.

## 5. Components

### Shared Primitives

| Component | Contract |
|-----------|----------|
| AppButton | Primary/secondary/ghost/danger; sm/md/lg; pill radius; button/link semantics; disabled/loading suppress activation; one primary per screen |
| FilterChip | `label`, `active`, `count`, `disabled`; default slot and click event; 44px hit area; selected and disabled states |
| SegmentedControl | String/number `modelValue`; options `{value,label,disabled?,id?,controls?}`; optional group `disabled`; tablist/selected semantics, roving focus, arrows wrap enabled options, Home/End select first/last enabled; no width animation |
| StatusBadge | Existing `ReadingStatus` and `STATUS_TEXT`: completed/current/not_completed/upcoming; never a separate today/missed enum |
| ListCard | Static 20px card with title/default slot; no decorative hover or lift |
| BottomSheet | `modelValue`, optional title; header-extra/default/footer slots with close; attrs on dialog; 36x4 handle; generic 20px top corners; existing `reading-settings-sheet` class selects 24px `--radius-sheet`; 350ms slide; ESC/scrim/down-drag dismissal; shared focus/scroll hooks |
| Common EmptyState | `title`/`description` override legacy `text`/`hint`, even when explicitly empty; legacy `guide` array and guide slot, `fullscreen`, icon/action slots and action event remain supported |

Buttons, chips, segments, badges and inputs use `--radius-pill: 999px`; small controls use `--radius-control: 10px`, calendar cells `--radius-cell: 4px`.

### Grouped Settings Section

- Structure: section title, bordered `--color-bg-card` container, stacked rows.
- Spacing: 20px card padding or 12px/20px list rows, 14px between sections; minimum 56px rows.
- States: default, hover for action buttons, disabled for unavailable login-method removal.
- Accessibility: real buttons for actions; helper text explains disabled destructive actions.

### Unified Modal

- Structure: `useModal().confirm` or `useModal().alert` rendered by `ModalHost`.
- Variants: primary, danger; warning, error, info, success icons.
- Destructive warning confirmations use a 52px icon container with `--color-error-bg` and `--color-error`; ordinary warning confirmations retain their warning colors.
- Accessibility: shared modal container owns focus and escape behavior.
- Rule: page-local Teleport modals are not used for ordinary confirmations.

### Inline Sensitive Panel

- Structure: card-like form embedded inside the settings column for password and account deletion.
- Spacing: 16px controls, 12px field gaps.
- States: loading, inline error text, cancel action.
- Accessibility: labeled password inputs and explicit submit buttons.

### Loading Skeletons

- One canonical `ui/Skeleton` atom owns token-based shimmer; `ui/skeleton/Skeleton` is an API-compatible wrapper for existing `rounded` consumers.
- Composite families mirror the loaded geometry: text/list rows, avatars, cards, calendars, stats, leaderboards, groups, plans, video/Hasena content, and admin summary/video rows.
- A loading region exposes one meaningful `role="status"` or `aria-busy="true"` boundary. Every placeholder shape inside it is decorative and `aria-hidden`.
- Initial unresolved data renders its matching family before empty/error content. Settled empty/error removes the skeleton; refreshes retain useful current content whenever possible.
- The dev-only `/__dev__/skeletons-preview` harness exposes every family plus pending, empty, error, dark, and forced reduced-motion states.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `0.15s` | ease | Button hover and press |
| Standard | `250ms` | ease | Completion color and tab indicator transitions |
| Enter | `450ms` | `cubic-bezier(.23,1,.32,1)` | Section opacity and 10px slide; 50ms stagger |
| Pop | `350ms` | `cubic-bezier(.34,1.56,.64,1)` | Completion check scale |
| Sheet | `350ms` | `cubic-bezier(0,0,.2,1)` | Bottom sheet slide |

- Animate color, opacity, and transform only; never segment width. Active controls scale to .97. Static containers do not animate on hover.
- Reduced motion removes enter/pop/sheet transforms and retains only opacity transitions.
- Every interactive control needs hover, active, focus, and disabled states.
- Respect shared `:focus-visible` styling from `main.css`.
- Skeleton shimmer uses the shared 1.6s token-colored gradient only while pending. `prefers-reduced-motion: reduce` replaces it with a static tertiary surface.

## 7. Depth & Surface

### Strategy

Cards use a 1px default border and `--shadow-card` (0 1px 2px rgba(0,0,0,.04), none in dark). Only clickable cards may lift 2px with `--shadow-card-hover`. Static ListCard containers never lift. Floating primary actions use `--shadow-cta`; sheets use `--shadow-sheet`, the shared overlay token and 2px backdrop blur. Avoid decorative shadows on repeated settings rows.

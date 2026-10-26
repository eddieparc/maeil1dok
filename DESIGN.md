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
| BottomSheet | `modelValue`, optional title; header-extra/default/footer slots with close; attrs on dialog; generic 20px top corners (`--radius-sheet-top`); existing `reading-settings-sheet` class selects 18px `--radius-sheet`; 350ms slide; ESC/scrim dismissal (drag handle removed); shared focus/scroll hooks |
| Common EmptyState | `title`/`description` override legacy `text`/`hint`, even when explicitly empty; legacy `guide` array and guide slot, `fullscreen`, icon/action slots and action event remain supported |

Buttons, chips, segments, badges and inputs use `--radius-pill: 999px`; small controls use `--radius-control: 10px`, calendar cells `--radius-cell: 4px`.

### Mobile Rendering and Reference Fidelity

- As of October 22, 2026, production primary screens use the existing full
  WebView. `EXPO_PUBLIC_NATIVE_UI` is explicitly false in the production profile.
  Native pages remain available for opted-in local parity work.
- The existing web UI is the visual and interaction reference for the next
  native release, including typography, content order, themes, icons, navigation
  and state transitions. Match actual paired renders rather than approving the
  native screens in isolation.
- The historical native-only capsule/light-shell exceptions below do not
  authorize divergence from that newer reference-fidelity requirement.

### Current Native Reference Contract

- Primary native pages follow the existing web layout and the saved reading
  theme. The outer OS safe areas remain cream in both themes.
- Below 1024px, use the full-width flat bottom navigation in layout flow:
  60pt content height, or 56pt while a Bible chapter is active, plus the bottom
  safe area. Do not render the historical floating capsule.
- At 1024px and above, use a 240px left sidebar with the same navigation state,
  tab-press cancellation and active-tab reselection behavior. General pages,
  including headers, are centered within 760px; Bible reader text stays fluid.
- Wide Home uses a main column up to 760px, a 300px secondary column and a 28px
  gap. The container has 36px vertical and 40px horizontal padding.
- Reader text uses 5px horizontal gutters through 768px and 16px above it.
  Korean words stay together in iOS text layout. Book and chapter selection
  columns use a zero basis and a 7:3 ratio.
- Android justified text uses zero tracking to keep platform justification
  measurement and painting consistent; negative tracking clips trailing glyphs
  on the validated Android 36.1 runtime. Alignment and the selected font remain
  unchanged. Other platform/alignment combinations retain web tracking.
- Reader sheets are centered with a 768px maximum width. The visible reading
  font options match the web: Pretendard, KoPub Batang and RIDI Batang, in that
  order. Previously stored additional font families remain supported.
- Guest Profile opens Login without changing the active tab. Schedule from an
  active chapter opens the full schedule sheet and restores the chapter when
  closed. Re-selecting the active Bible tab returns to the Bible home.

### Historical Native App Navigation (Superseded)

- The native app shell uses the light palette consistently, including shared
  sheets and status-bar chrome, regardless of system appearance. An explicitly
  supplied component mode and the user's reading-content theme remain separate.
- The iOS floating tab bar has one opaque `--color-bg-card` surface, a 1px
  `--color-border-default` outline, and no glass/material layers. Elevation uses
  `--color-text-primary` at 8% opacity, 12pt radius and 4pt vertical offset.
- Active items use `--color-accent-primary` on `--color-accent-bg`; inactive
  items use `--color-text-secondary`, never tertiary text. The selected capsule
  has no outline or separate shadow.
- The capsule is 56pt tall: 44pt item targets plus 6pt inner padding per edge.
  Keep a 16pt screen gutter, 480pt maximum width, and 8pt gap above the bottom
  safe area. Screen scroll padding includes this entire overlay exactly once.
- Symbols are 22pt, labels are 11pt with selected semibold weight. Selection
  transitions take 250ms; presses use opacity 0.85 and scale 0.97 over 150ms.
  Reduced motion disables selection movement and press scaling.
- Native light screens use dark system status-bar icons. Icons without visible
  text have accessible action labels and at least a 44pt target.
- Schedule month chips are at least 44pt high. Layout and selection changes
  reveal the selected month without a timer. The list also clears its 96pt
  bulk-action region and 68pt floating-top-action region when those are shown,
  in addition to the bottom navigation inset.

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
### Reader Footer Advertisement

- One manual ad after the Bible content and chapter actions; no landing, navigation,
  login, error, loading, native WebView, overlay, or sticky placements.
- Preserve the reader's existing scrolling; observe visibility against the browser
  viewport (the content container can be taller than the screen). The slot uses the
  [center pattern](https://github.com/changeroa/StyleGallery/blob/main/patterns/centering/center.md):
  fluid width up to 320px, centered, with no internal scrolling.
- Creative height is fixed at 50px in a 50px parent; do not crop or scale creatives.
  This restricted parent opts the slot out of Google's mobile size optimization.
- Separate from chapter actions by 32px. Use a 12px sans-serif `광고` label,
  tertiary text, 8px label gap, and no decorative card or animation.
- Request only when the slot enters the reader viewport. Collapse on script failure
  or Google's `unfilled` result; never hide a filled ad.
- Legal copy links remain underlined so the ad privacy controls are discoverable.

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

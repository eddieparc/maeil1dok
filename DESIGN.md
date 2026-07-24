# Maeil1Dok Design System

## 1. Atmosphere & Identity

Maeil1Dok feels like a quiet daily reading desk: calm, legible, and trustworthy. The signature is warm-paper restraint with deep oxblood actions, where account and reading workflows feel steady rather than flashy.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--color-bg-primary` | `#faf8f6` | `#1a1a1a` | App background |
| Surface/secondary | `--color-bg-secondary` | `#ffffff` | `#242424` | Secondary panels |
| Surface/tertiary | `--color-bg-tertiary` | `#f5f3f0` | `#2d2d2d` | Subtle section contrast |
| Surface/card | `--color-bg-card` | `#ffffff` | `#2a2a2a` | Cards, grouped rows, modal bodies |
| Text/primary | `--color-text-primary` | `#1f2937` | `#f3f4f6` | Main copy and headings |
| Text/secondary | `--color-text-secondary` | `#4b5563` | `#d1d5db` | Supporting copy |
| Text/tertiary | `--color-text-tertiary` | `#6b7280` | `#9ca3af` | Metadata and low-emphasis text |
| Border/default | `--color-border-default` | `#e5e7eb` | `#3d3d3d` | Card and control borders |
| Border/light | `--color-border-light` | `#f0f0f0` | `#333333` | Row dividers |
| Accent/primary | `--color-accent-primary`, `--primary-color` | `#2A1111` | `#2A1111` | Primary actions and focus |
| Accent/hover | `--color-accent-primary-hover`, `--primary-dark` | `#3A1A1A` | `#3A1A1A` | Primary hover |
| Status/success | `--color-success` | `#2A1111` | `#2A1111` | Confirmed states |
| Status/warning | `--color-warning` | `#f59e0b` | `#fbbf24` | Caution states |
| Status/error | `--color-error` | `#ef4444` | `#f87171` | Destructive actions |

### Rules

- Deep oxblood (`#2A1111`) is reserved for true actions, links, focus, and completion states.
- Text on a `#2A1111` action/background surface must be white.
- Destructive actions use `--color-error` and `--color-error-bg`, with explicit confirmation.
- Provider brand colors may appear only inside provider icons or small provider badges.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H1 | `1.25rem` to `1.5rem` | 600 | 1.3 | 0 | Mobile-first page titles |
| H2 | `0.875rem` | 600 | 1.4 | `0.05em` | Section labels |
| Body | `1rem` | 400-500 | 1.6 | 0 | Main controls |
| Body/sm | `0.875rem` | 400 | 1.5 | 0 | Secondary information |
| Caption | `0.75rem` | 500 | 1.4 | 0 | Notes and metadata |

### Font Stack

- Primary: `Pretendard`, system UI, sans-serif.
- Reading serif: `KoPub Batang`, `RIDIBatang`, `Noto Serif KR`.

### Rules

- Account and operational screens use the sans stack for fast scanning.
- Reading surfaces may use serif typography through reading settings.
- Avoid viewport-scaled text. Keep tracking at 0 except small section labels.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-1` | `0.25rem` | Icon and label gaps |
| `--spacing-2` | `0.5rem` | Tight row internals |
| `--spacing-3` | `0.75rem` | Form field gaps |
| `--spacing-4` | `1rem` | Standard row and card padding |
| `--spacing-6` | `1.5rem` | Modal and panel padding |
| `--spacing-8` | `2rem` | Major section spacing |

### Grid

- Account and settings surfaces use a single constrained column, 600px maximum.
- General content containers use `container-responsive`: 900px at tablet and 1200px at desktop.
- Mobile touch targets stay at least 44px tall where practical.

## 5. Components

### Grouped Settings Section

- Structure: section title, bordered `--color-bg-card` container, stacked rows.
- Spacing: 16px row padding, 16px row gaps, 32px section gaps.
- States: default, hover for action buttons, disabled for unavailable login-method removal.
- Accessibility: real buttons for actions; helper text explains disabled destructive actions.

### Unified Modal

- Structure: `useModal().confirm` or `useModal().alert` rendered by `ModalHost`.
- Variants: primary, danger; warning, error, info, success icons.
- Accessibility: shared modal container owns focus and escape behavior.
- Rule: page-local Teleport modals are not used for ordinary confirmations.

### Inline Sensitive Panel

- Structure: card-like form embedded inside the settings column for password and account deletion.
- Spacing: 16px controls, 12px field gaps.
- States: loading, inline error text, cancel action.
- Accessibility: labeled password inputs and explicit submit buttons.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `0.15s` | ease | Button hover and press |
| Standard | `0.25s` | ease | Panel open and color transitions |

- Animate color, opacity, and transform only.
- Every interactive control needs hover, active, focus, and disabled states.
- Respect shared `:focus-visible` styling from `main.css`.

## 7. Depth & Surface

### Strategy

Mixed but restrained: grouped operational surfaces use borders; modal and overlay depth is handled by the shared modal system. Avoid decorative shadows on repeated settings rows.

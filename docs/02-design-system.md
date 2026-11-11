# 02 · Design system

Visual idea: **a Maps-style app dressed as a travel journey.** Calm map base, frosted glass panels floating over it, and travel motifs: boarding-pass tickets, passport stamps, a plane, a compass, a sunrise welcome scene.

Source of truth: `design/tokens/theme.css` (light), `theme-dark.css` (dark), `tokens.json`. Reference renders are in `design/screens/`.

## Principles
1. The map is the hero. UI floats over it as glass and never hides more than 40% of it.
2. One primary action per screen, at thumb height.
3. Every state is designed: loading, empty, error, offline, expired.
4. Motion explains, never decorates. Everything stops under reduced motion.
5. Large targets (44 px or more), high contrast, no color-only meaning.

## Color tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | #12263A | #EAF1F8 | Primary text |
| `--muted` | #566B7F | #A9B8C8 | Secondary text |
| `--blue` | #1A73E8 | #8AB4F8 | Primary action, "you" |
| `--blue-d` | #174EA6 | #8AB4F8 | Links, icons on tint |
| `--tint` | #E6F0FF | rgba(138,180,248,.18) | Selected background |
| `--coral` | #FF6B4A | #FF8F66 | Destination, stamps, accents |
| `--sea` / `--sea-d` | #0E9F9A / #0B6F6B | #2DD4BF / #5EEAD4 | Secondary accent |
| `--sun` | #FFC857 | #FFC857 | Sun, warnings highlight |
| `--green` / `--green-bg` | #137333 / #E3F5E8 | #7DD99A / rgba | Arrived, success |
| `--amber` / `--amber-bg` | #8A4B00 / #FFF1D6 | #FFC857 / rgba | Soon, warning |
| `--red` / `--red-bg` | #C5221F / #FDE7E4 | #FF8A80 / rgba | End, delete, offline |
| `--sand` | #FFF6E5 | #0F1B2D | Page background for lists |
| Screen base | #F3EFE6 | #0B1524 | Map land color |

Friend colors (white text on each passes 4.5:1): teal `#0F6E56`, purple `#534AB7`, rust `#993C1D`, amber `#854F0B`, rose `#993556`, blue `#1A73E8` (always "you").

## Typography
- Display and UI: **Plus Jakarta Sans** (400, 500, 600, 700, 800). Codes and numbers in trip codes: **DM Mono** 500.
- Scale: H1 28/34 800, H2 22/28 800, H3 16/22 700, Body 15/21 500, Sub 14/20 400, Caption 12/16 600, Button 15 700.
- Trip code: DM Mono 30/36, letter-spacing 4 px.

## Spacing, radius, elevation
- 4 px grid. Screen padding 20 px (sheets) or 12 px (floating panels). Gaps 8 / 12 / 16.
- Radius: control 14, button 16, card 20, sheet 28, pill 999, avatar full.
- Shadow (light): `0 10px 30px rgba(14,42,71,.18)`. Dark: `0 10px 30px rgba(0,0,0,.45)`.

## The glass recipe
```css
.glass{
  background: rgba(255,255,255,.62);            /* dark: rgba(18,32,50,.62) */
  backdrop-filter: blur(18px) saturate(1.6);
  border: 1px solid rgba(255,255,255,.75);      /* dark: rgba(255,255,255,.14) */
  box-shadow: 0 10px 30px rgba(14,42,71,.18), inset 0 1px 0 rgba(255,255,255,.9);
}
.glass-strong{ background: rgba(255,255,255,.8); }  /* text-heavy sheets */
```
Rules: use `glass-strong` under body text so contrast stays 4.5:1. Provide a solid fallback when `backdrop-filter` is unsupported (`@supports not (backdrop-filter: blur(1px))`). Limit blurred layers on screen to 3 for performance.

## Components
| Component | Spec |
|---|---|
| Button primary | 52 high, radius 16, blue bg, white (dark: ink on light-blue) text, shine sweep every 3.8 s, press scale .97 |
| Button glass | 52 high, glass bg, blue text |
| Button danger / soft danger | Solid red / red tint |
| Chip | 44 high, pill, glass; `.on` = solid blue |
| Icon button | 44 x 44, round |
| FAB | 56 (or 44 small), round, glass |
| Input | 52 high, radius 14, 1.5 px border, focus 2 px blue ring, label above |
| Password field | Eye toggle 44 x 44 inside the field |
| Switch | 56 x 44 hit area, 40 x 24 visual track |
| Segmented control | 4 px padding, active = white (dark: glass) |
| Top bar | Floating glass pill 56 high at 12 px inset |
| Bottom nav | Floating glass pill 68 high: Explore, Trips, Alerts, You |
| Sheet | Radius 28 top, drag handle 40 x 4, rises on enter |
| Dialog | Centered glass card, radius 28, scrim blur 4 px |
| Friend dot | 38 px circle, 3 px border, name tag below, checkmark badge when arrived, dim when stale |
| You dot | 22 px core, pulsing 72 px halo |
| ETA row | Avatar 40, name, caption, badge (amber under 5 min, blue otherwise, green arrived) |
| Boarding pass | Ticket with side notches, dashed perforation, trip code in mono, barcode |
| Stamp | Double-ring circle, rotated -14 degrees, stamps in with overshoot |
| Toast | Glass pill dropping from top, auto-dismiss 4 s, `aria-live="polite"` |
| Chat bubble | Friend: glass left, radius 4 18 18 18. Mine: blue right, radius 18 4 18 18 |
| Progress track | 6 px, fills from left on enter |

## Icons
Stroke icons, 24 px grid, 2 px stroke, round caps and joins (Lucide set). Sizes 16, 20, 24, 32. Decorative icons `aria-hidden`; icon-only buttons need `aria-label`. No emoji.

## Map style (Mapbox custom style, build from the SVG references in `design/assets/`)
| Layer | Light | Dark |
|---|---|---|
| Land | #F3EFE6 | #0F1C2E |
| Parks | #CBE7C5 | #17352B |
| Water | #A9D8F5 | #123A5C |
| Road casing | #DDD6C8 | #07111E |
| Road | #FFFFFF | #2A3C52 |
| Highway | #FFE3A0 (casing #E8B64A) | #C99A3B (casing #8A6A1F) |
| Labels | #5F6B78 | #8CA0B5 |
Route lines are dotted (`2 10` dash), 4 px, in the member's color, animated marching. Destination pin is coral with an expanding ripple.

## Dark theme rules
Same layout. Deep navy base, glass becomes translucent navy, accents shift to lighter tints, primary button becomes light blue with dark text, status colors use tinted backgrounds. Switch via `data-theme="dark"`; follow `prefers-color-scheme` until the user chooses.

## Accessibility checklist
- Targets 44 x 44 or larger. Focus ring 3 px blue, offset 2 px.
- Text 4.5:1, large text 3:1. Status is never color only (icon or text too).
- Real elements with labels. Dialogs trap focus and restore it on close. Esc closes sheets.
- Live updates: toasts and ETA changes announced politely; do not announce every location tick.
- Reduced motion: animations off, state changes immediate.
- Test with screen reader (VoiceOver/TalkBack), 200% text zoom, and keyboard only.

## Responsive
Mobile first at 390 px. Up to 600 px the layout is the same, centered. 600 to 1024 px: map fills, sheets become a left panel 380 px wide. Desktop 1024 px or more: left panel plus map, chat as a side panel.

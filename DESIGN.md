# Plainvoice — Design System (Stripe-inspired)

Applied from the `voltagent/awesome-design-md` Stripe `DESIGN.md`.
**Deep-navy ink · electric indigo primary · Inter at weight 300 with negative
tracking · tabular figures for money · pill buttons · cool off-white surfaces ·
gradient-mesh marketing hero.**

Single source of truth: `:root` tokens + component classes in `src/styles/global.css`.

## Fonts
- **Display + body:** Inter (Google Fonts), weights 300/400/500/600. Display tiers at **300** with negative letter-spacing (the Stripe signature). `font-feature-settings: "ss01"` globally.
- **Money / numerics:** Inter with `font-feature-settings: "tnum"` (tabular) via `.num` / `.mono`.

## Color tokens
| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#F6F9FC` | page background (cool off-white) |
| `--paper-2` / `--paper-3` | `#FFFFFF` | cards / inputs / invoice sheet |
| `--ink` | `#0D253D` | body text (deep navy, never black) |
| `--ink-soft` | `#273951` | secondary text |
| `--ink-faint` | `#64748D` | helper / labels |
| `--line` / `--line-strong` | `#E3E8EE` / `#CDD6E0` | hairlines / borders |
| `--accent` / `--accent-2` | `#533AFD` / `#4434D4` | electric indigo — CTAs, links, focus |
| `--accent-wash` | `#ECEAFE` | focus ring, soft indigo bg |
| `--red` / `--red-wash` | `#EA2261` / `#FCE4EC` | ruby — overdue / destructive |
| `--amber` | `#9C6B1F` | sent status |

Radii: `--r` 12px (cards) / `--r-sm` 6px (inputs) / buttons are pills (999px).
Shadows: `--shadow` (1px lift) / `--shadow-lg` (floating panels), tinted `rgba(0,55,112,…)`.

## Signatures
- **Pill buttons**, indigo fill, tight padding. Indigo reserved for CTAs + links (one filled per area).
- **Tabular money** everywhere a figure appears.
- **Gradient-mesh hero** — pastel cream → orange → lavender → indigo → ruby wash across the landing hero (`.hero::before`).
- Invoice template default accent is indigo; the color picker offers the Stripe palette.

## Routes
- `/` landing · `/new` editor · `/invoice?id=` / `/estimate?id=` edit · `/app` list.

## Motion
`prefers-reduced-motion: reduce` disables all animation/transition.

# Plainvoice — Design System

Warm-paper editorial aesthetic, ported from the Phase 0 prototype
(`plainvoice-prototype_1.html`). **Ink on warm paper, forest-green accent,
serif display + mono numerals, subtle paper grain.**

Single source of truth: the `:root` tokens + component classes in
`src/styles/global.css`. Tailwind v4 utilities are aliased to these tokens via
`@theme inline`, so `bg-paper`, `text-ink`, `text-accent` etc. track the palette.

## Fonts (Google Fonts, loaded in global.css)
- **Display / headings:** Fraunces (serif) — `--display`
- **Body / UI:** Hanken Grotesk — `--sans`
- **Numerals (money, totals, invoice #):** JetBrains Mono, tabular-nums — `--mono` / `.mono` / `.num`

## Color tokens
| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#F4F0E6` | page background |
| `--paper-2` | `#FBF8F0` | panels / cards |
| `--paper-3` | `#FFFFFF` | inputs / invoice sheet |
| `--ink` | `#211F18` | primary text |
| `--ink-soft` | `#5B584C` | secondary text |
| `--ink-faint` | `#8B8678` | labels / muted |
| `--line` / `--line-strong` | `#E3DCCB` / `#D2C9B3` | borders / hairlines |
| `--accent` / `--accent-2` | `#1E5B41` / `#2C7C58` | forest green — actions, links |
| `--accent-wash` | `#E7F0E9` | focus ring, accent bg |
| `--amber` / `--amber-wash` | `#9C6B1F` / `#F5ECD8` | sent status |
| `--red` / `--red-wash` | `#9A382C` / `#F3E0DC` | overdue / destructive |

Radii `--r` 14px / `--r-sm` 9px. Buttons are pills (999px). Shadows: `--shadow`, `--shadow-lg`.

## Status chips (`.chip.<status>`)
`draft` → ink-soft outline · `sent` → amber · `viewed` → accent wash · `paid` → solid accent · `overdue` → red

## Structure / routes
- `/` — marketing landing (hero, them-vs-you, Pricing Promise, switcher, AI). Static, GEO-friendly.
- `/new` — invoice editor (app-bar + Details/Line-items panels + live preview).
- `/invoice?id=` — edit existing invoice (same editor).
- `/app` — invoice list.

## Motion
- `prefers-reduced-motion: reduce` disables all animation/transition (handled globally in global.css).
- Logo checkmark draws once; hero cards float gently; sections reveal on scroll (landing only).

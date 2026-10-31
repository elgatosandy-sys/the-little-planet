# The Little Planet — Full Design System Reference

> Detailed companion to the root `README.md`.

---

## Color Palette

All colors are **CSS custom properties** defined in `styles/design-tokens.css`.
Themes can be swapped at runtime by overriding these variables on `:root`.

| Role | Token | Hex |
|------|-------|-----|
| Cosmic deep background | `--color-charcoal` | `#17151B` |
| Cosmic midground / paper text | `--color-burgundy` | `#482630` |
| Buttons, borders, accents | `--color-dusty-pink` | `#D7A3AD` |
| Paper backgrounds | `--color-warm-cream` | `#F1E7DC` |
| Warm luminous gold | `--color-gold` | `#D4AF7F` |
| Soft lavender | `--color-lavender` | `#9B8CB8` |
| Muted pink-violet | `--color-pink-violet` | `#A88B9E` |
| Planet green | `--color-planet-green` | `#6B8E6B` |

### Gradients
```css
--gradient-cosmic: radial-gradient(ellipse at 50% 0%, var(--color-burgundy), var(--color-charcoal) 70%);
--gradient-paper:   linear-gradient(160deg, var(--color-warm-cream) 0%, #F8F0E6 100%);
```

### Semantic aliases
| Token | Purpose |
|-------|---------|
| `--color-text-primary` | Text on light surfaces |
| `--color-text-secondary` | Muted text |
| `--color-text-on-dark` | Text on cosmic backgrounds |
| `--color-border-paper` | Dusty-pink border (25% opacity) |
| `--color-shadow-soft` | Soft charcoal shadow |
| `--color-shadow-strong` | Strong charcoal shadow |
| `--color-focus-ring` | Gold focus outline |
| `--color-success` | Green for success states |
| `--color-error` | Red for error states |

---

## Typography

| Token | Value | Notes |
|-------|-------|-------|
| `--font-serif` | `Cormorant Garamond` | Headings |
| `--font-sans` | `Inter` (system fallbacks) | Body, buttons |
| `--font-hand` | `Kalam` | Handwriting accents |

### Fluid scale (mobile → desktop)
```css
--text-body-size: clamp(0.875rem, 0.5vw + 0.8rem, 1.0625rem);
--text-h1-size:   clamp(1.75rem,  2.5vw + 1rem, 2.75rem);
--text-h2-size:   clamp(1.4rem,   1.8vw + 0.9rem, 2.125rem);
--text-h3-size:   clamp(1.125rem, 1.4vw + 0.75rem, 1.5rem);
--text-h4-size:   clamp(1rem,     1.2vw + 0.7rem, 1.25rem);
--text-hand-size: clamp(0.875rem,  0.6vw + 0.7rem, 1.05rem);
```

### Utility classes
```html
<h1 class="h1">Big title</h1>
<p class="body-text">Readable body text.</p>
<p class="h3">Sub-heading</p>
<span class="hand-text">Handwritten note</span>
```

---

## Spacing & Shape

8-point grid:
```css
--space-3xs: 0.25rem;  --space-3xl: 6rem;  /* 4px → 96px */
```

Border radius:
```css
--radius-xs: 0.25rem;  --radius-full: 9999px;
```

---

## Motion Tokens

| Token | Value |
|-------|-------|
| `--duration-short` | 0.15 s (presses) |
| `--duration-md` | 0.3 s (hovers, small transitions) |
| `--duration-lg` | 0.5 s (page transitions) |
| `--duration-xl` | 0.8 s (final reveals) |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-gentle` | `cubic-bezier(0.33, 0.2, 0.2, 1)` (soft landing) |

All durations collapse to `0.001s` under `prefers-reduced-motion`.

---

## Button System

```html
<button class="btn btn--primary">Primary</button>
<button class="btn btn--secondary">Secondary</button>
<button class="btn btn--ghost">Ghost</button>
<button class="btn btn--primary btn--sm">Small</button>
<button class="btn btn--primary btn--lg">Large</button>
<button class="btn btn--loading" aria-busy="true">Saving…</button>
<button class="btn btn--primary" disabled>Disabled</button>
```

- `.btn--block` — full width
- `.btn--loading` — spinner via `::after`
- All variants support `:focus-visible` with a gold outline

---

## Page Transition (Golden Star Sweep)

Driven by `styles/transitions.css` and `js/main.js` `Router`.

```
fadeOut → starSweep (golden band) → renderStage → fadeIn → cleanup
```

Key elements:
- `#page-transition` — full-screen overlay (hidden, `aria-hidden="true"`)
- `.page-transition__sweep` — the sweeping band with 28 star particles
- `.scene--fading-out`, `.scene--preparing-fade-in`, `.scene--faded-in` — applied to `#main-content`

Stage 10 (`STAGE_10`) uses a slower (~900 ms) sweep.

---

## Animation Primitives

| Class / Keyframe | Effect |
|-----------------|--------|
| `[data-animate="fade-in"].is-visible` | Fade in |
| `[data-animate="scale-in"].is-visible` | Fade + scale up |
| `[data-animate="stagger"].is-visible > *` | Staggered children (75 ms steps) |
| `.float` | Gentle vertical drift (6 s) |
| `.rotate-slow` | Slow planet rotation (60 s) |
| `particleBurst(x, y)` | JS helper → golden particle burst |

---

## JavaScript Architecture

Single bundled `js/main.js` (IIFE, `"use strict"`). Structure:

1. **EventBus** — pub/sub (`on`, `off`, `emit`, `clear`)
2. **Animation helpers** — `prefersReducedMotion()`, `particleBurst()`, `createStarfield()`
3. **Router** — `STAGES` constants, `registerStage()`, `navigateTo()`, `initRouter()`
4. **PageContainer** — `PageContainer()`, `ContentWrapper()`, `PaperCard()`, `ScrapbookCard()`
5. **Preview** — `renderPreview()` generates the dev-screen content
6. **App boot** — registers stages, inits router, sets document title

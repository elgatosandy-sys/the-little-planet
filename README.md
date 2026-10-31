# The Little Planet

An interactive **Sweet 16 birthday website** for **Miruna (Rumi)** — October 22, 2026.

A storybook-style site across **10 stages**, tied together by a shared **golden-star page transition**.

---

## ▶️ Quick Start

### Option A — Static file (no server needed, no persistence)
Open `index.html` in a modern browser. The site works, but:
- Page 2 "Save my wish" button will not persist (no server to call)
- Page 9 "Private Messages" will not work

### Option B — Local server (full persistence) — **recommended**
```sh
# 1) Install Node.js >= 22.5 (includes built-in SQLite)
# 2) Start the server:
npm start
# or:
node server/index.mjs
```

The server runs on `http://localhost:8080` and provides:
- Real SQLite persistence for Page 2 birthday wishes
- Static file serving (the whole site over HTTP)
- Admin-only retrieval of saved wishes (never exposed to browsers)

---

## 💾 Birthday Wish Persistence (Page 2)

When Miruna chooses **"Save my wish ✨"**:

1. **Client validates**: 1,000-character max, trims whitespace, shows live counter
2. **Idempotency key** generated client-side (repeated clicks/retries → one record)
3. **POST /api/wishes** sent with `{ id: <key>, wish: <text> }`
4. **Server validates again** and saves to `server/data/wishes.db` (real SQLite file)
5. **Response**: `{ ok: true, saved: true, id: <record-id>, created_at: <ISO> }`
6. **Confirmation shown**: "Your star has been saved! ✨" (only after DB confirms)

**"Keep it to myself"**: sends NO request, creates NO record — the wish stays in memory only until the page unloads.

---

## 🔐 Admin Wish Retrieval (privileged only)

```sh
# List all saved wishes (requires admin key)
npm run read-wishes
# or:
node tools/read-wishes.mjs
```

The admin key is **never** in client code. It lives in:
- `LITTLE_PLANET_ADMIN_KEY` environment variable, or
- `server/data/admin.key` (auto-generated on first server run)

---

## 🧪 Tests

```sh
# Run all tests (runtime structural + API integration)
npm test

# Runtime checks only (syntax, stage registrations, 16 candles, CSS)
npm run test:runtime

# API tests only (real server + fetch, 21 scenarios)
npm run test:api
```

What the API tests verify:
1. ✅ A submitted wish persists (and survives a server restart)
2. ✅ "Keep it to myself" creates no database record
3. ✅ Failed submissions preserve the text and allow retry
4. ✅ Duplicate submissions (same idempotency key) create ONE record
5. ✅ Unauthenticated visitors cannot retrieve saved wishes (404)
6. ✅ Privileged credentials (admin key) are not exposed to clients
7. ✅ Validation: empty / too-long / malformed wishes rejected
8. ✅ Rate limiting kicks in for repeated submissions

---

## 📁 Project Structure

```
the-little-planet/
├── index.html                    # Entry point (loads all CSS + main.js)
├── favicon.svg                  # Star + cream planet favicon
├── package.json                 # Metadata + npm scripts
├── .gitignore
├── server/
│   └── index.mjs               # Zero-dep Node server: SQLite + static serve
├── tools/
│   └── read-wishes.mjs         # Privileged wish retrieval (admin key)
├── test_runtime.mjs            # Structural checks (syntax, stages, candles, CSS)
├── test_api.mjs                # Real server + fetch integration tests
├── styles/
│   ├── design-tokens.css       # Global CSS custom properties (colors, type, space…)
│   ├── base.css                # Modern reset + typography base + a11y utilities
│   ├── components.css          # Button system, cards
│   ├── animations.css          # Keyframe primitives (fade, float, sparkle, …)
│   ├── transitions.css         # Page-transition overlay + golden star sweep
│   ├── pages.css               # Page/scene backgrounds + starfield + footer
│   └── preview.css             # Development preview screen styles
├── js/
│   ├── main.js                 # Bundled app: EventBus, Router, Stage 1, helpers
│   └── stages.js               # Stages 2–6 implementations
└── docs/
    └── README.md               # Full design system reference
```

---

## 🎨 Design System Summary

Design tokens are centralized in **`styles/design-tokens.css`** as CSS custom properties.

| Token | Value | Role |
|-------|-------|------|
| `--color-charcoal` | `#17151B` | Cosmic background |
| `--color-burgundy` | `#482630` | Text / cosmic midground |
| `--color-dusty-pink` | `#D7A3AD` | Buttons, borders, accents |
| `--color-warm-cream` | `#F1E7DC` | Paper backgrounds |
| `--color-gold` | `#D4AF7F` | Focus ring, sparkles |
| `--color-lavender` | `#9B8CB8` | Accent |
| `--color-pink-violet` | `#A88B9E` | Accent |
| `--color-planet-green` | `#6B8E6B` | Planet / success |

### Typography

| Role | Font | Use |
|------|------|-----|
| Storybook serif | **Cormorant Garamond** | Headings |
| Clean sans | **Inter** | Body, buttons, forms |
| Handwriting | **Kalam** | Decorative labels only |

All type scales use fluid `clamp()` between 320 px and 1200 px.

### Buttons

Three shared variants (`.btn--primary`, `.btn--secondary`, `.btn--ghost`)
all with hover, focus, and `:active` states. Reduced-motion aware.

See **`docs/README.md`** for the full design system reference.

---

## 🔄 Page Transitions

Each stage transition runs through a **golden-star sweep**:

1. Current scene fades out (`scene--fading-out`)
2. Golden + dusty-pink star band sweeps across (`.page-transition__sweep`)
3. Next scene fades in (`scene--faded-in`)

Stage 10 receives a slower, quieter sweep. Under
`prefers-reduced-motion`, transitions become simple fades.

Register a new stage:
```js
registerStage(STAGES.STAGE_1, renderStage1);
navigateTo(STAGES.STAGE_1);
```

---

## ♿ Accessibility

- Skip link for keyboard users
- Visible focus ring (gold) on all interactive elements
- `prefers-reduced-motion` respected everywhere (animations collapse to fades)
- Screen-reader status region (`aria-live="polite"`) for announcements
- Safe-area insets for mobile notches (`env(safe-area-inset-*)`)
- Touch targets ≥ 44 px
## 🎨 Design System Summary

Design tokens are centralized in **`styles/design-tokens.css`** as CSS custom properties.

| Token | Value | Role |
|-------|-------|------|
| `--color-charcoal` | `#17151B` | Cosmic background |
| `--color-burgundy` | `#482630` | Text / cosmic midground |
| `--color-dusty-pink` | `#D7A3AD` | Buttons, borders, accents |
| `--color-warm-cream` | `#F1E7DC` | Paper backgrounds |
| `--color-gold` | `#D4AF7F` | Focus ring, sparkles |
| `--color-lavender` | `#9B8CB8` | Accent |
| `--color-pink-violet` | `#A88B9E` | Accent |
| `--color-planet-green` | `#6B8E6B` | Planet / success |

### Typography

| Role | Font | Use |
|------|------|-----|
| Storybook serif | **Cormorant Garamond** | Headings |
| Clean sans | **Inter** | Body, buttons, forms |
| Handwriting | **Kalam** | Decorative labels only |

All type scales use fluid `clamp()` between 320 px and 1200 px.

### Buttons

Three shared variants (`.btn--primary`, `.btn--secondary`, `.btn--ghost`) all with hover, focus, and `:active` states. Reduced-motion aware.

See **`docs/README.md`** for the full design system reference.

---

## 🔄 Page Transitions

Each stage transition runs through a **golden-star sweep**:

1. Current scene fades out (`scene--fading-out`)
2. Golden + dusty-pink star band sweeps across (`.page-transition__sweep`)
3. Next scene fades in (`scene--faded-in`)

Stage 10 receives a slower, quieter sweep. Under `prefers-reduced-motion`, transitions become simple fades.

Register a new stage:
```js
registerStage(STAGES.STAGE_1, renderStage1);
navigateTo(STAGES.STAGE_1);
```

---

## ♿ Accessibility

- Skip link for keyboard users
- Visible focus ring (gold) on all interactive elements
- `prefers-reduced-motion` respected everywhere (animations collapse to fades)
- Screen-reader status region (`aria-live="polite"`) for announcements
- Safe-area insets for mobile notches (`env(safe-area-inset-*)`)
- Touch targets ≥ 44 px
- Real selectable HTML text (no text baked into images)

---

## 📜 License

Private — created for Miruna's 16th birthday celebration.

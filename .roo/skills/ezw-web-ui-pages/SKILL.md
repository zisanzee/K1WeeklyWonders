---
name: ezw-web-ui-pages
description: Use when building or restyling any React page, route, component or panel in EZ Wonders (not a canvas game) - Tailwind v4, the shared aura-* Aurora theme, Fredoka, cn(), motion, zustand stores and apiClient usage, new routes, SEO canonical/sitemap, PWA manifest, ErrorBoundary, kid and teacher friendly layout.
---

# Building pages and UI (React 19 + Tailwind v4 + Aurora)

## Before writing UI
1. Read `src/app/aurora.css`, `plans/unified-aurora-theme.md`, and the closest existing page in `src/pages/` (and `BetaHome.jsx` for the `Icon` library, gradients, backdrop layers).
2. Check `src/ui/` for existing pieces: `GameIcon`, `BrandLoader`, `ErrorBoundary`, `RotateHint`, `confirmDialog`, `FeedbackButton`, `ContactStrip`. `SwitchPlayerButton` already exists in `BetaHome.jsx`; don't add another.
3. Reuse; add a new `aura-*` class in `aurora.css` only if nothing fits. **Never hand-roll new sky/white themes.**

## Styling rules
- Tailwind v4: theme is CSS (`@import "tailwindcss"` + `@theme` in `src/app/index.css`). **No `tailwind.config.js`**; don't create one.
- Fonts: **Fredoka only**, loaded once in `index.html`. `.font-heading` / `.font-body` live in `index.css`. Never add a component-level Google Fonts `<link>` or re-declare those classes; never reference Nunito.
- `cn()` from `@/ui/cn.js` only; no direct `clsx`/`tailwind-merge` imports elsewhere.
- Animation: `import { motion } from 'motion/react'`. Respect `prefers-reduced-motion`. `react-confetti` only for level-complete overlays.
- Imports: `@/` alias across folders; relative only between siblings.

## Layout and UX
- Kid-facing: large targets (44px+), minimal text, icon/emoji driven, forgiving flows, works portrait and landscape.
- Teacher-facing: denser, but phones get stacked cards and sm+ gets tables. Destructive actions confirm (two-tap "Confirm?" or `confirmDialog`).
- Accessible contrast on the aurora backdrop; labels on icon-only buttons; keyboard-usable dialogs.
- Wrap new top-level surfaces in an `ErrorBoundary` so a failed lazy chunk can't blank the app. Lazy-load heavy pages.

## Data and state
- All network calls through `@/api/apiClient.js` (`API_BASE`, `withQuery`, `fetchWithTimeout`, `requestJson`, `postJson`, `ApiError`). Never redeclare an origin or hand-roll a timeout (a missing one hung app boot before).
- Extend the existing zustand store/helper for a domain (`playerStore`, `gameAccess`, `students`, `systemConfig`) instead of creating a parallel one. Use selectors.
- `playerStore` persists only `{code,name,mode}`. Everything else is runtime-derived. `classType` is deprecated: use `classId`.
- localStorage keys are namespaced (`ezw.<thing>.v1`); reuse shared keys (e.g. `ezw-muted-v1`).

## Adding a route (non-game)
1. Games never get hand-added routes (registry only). Other pages are routed in `src/app/main.jsx` inside the existing provider/boundary structure.
2. Decide gating: public (like `/teacher-onboarding`) or inside `NameGate`. Teacher-needed public pages during outages go in `PUBLIC_DURING_MAINTENANCE` (`MaintenanceGate.jsx`).
3. SEO: add indexable public routes to `INDEXABLE_ROUTES` in `src/seo/seo.jsx` **and** `public/sitemap.xml`; otherwise they're `noindex` with the root canonical.
4. Static copy/imagery for content-heavy pages lives in a separate content file (pattern: `teacherOnboardingContent.js`), never inside the component. Never name it so it differs from the component only by case.

## PWA / platform
`public/site.webmanifest` is hand-maintained (`VitePWA` uses `manifest: false`). API is never cached by the service worker. Phaser isn't precached. See `ezw-tablet-performance` for load-speed work.

## Finish
Run lint + build (skill `ezw-verify-and-playtest`) and list the screens/roles/viewports a human should eyeball.

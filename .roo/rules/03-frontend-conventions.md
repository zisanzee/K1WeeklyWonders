# Frontend conventions

## Imports and helpers
- `@/` alias -> `src/` for cross-folder imports; relative only between siblings. The alias must agree in `vite.config.js`, `vitest.config.js` and `jsconfig.json`.
- `cn()` lives in `@/ui/cn.js`, the only file importing `clsx` / `tailwind-merge`. Import it, never redefine it.
- Animation: `import { motion } from 'motion/react'`.
- Phaser games use Phaser's native input and `this.sound`. `@dnd-kit` is DOM-only (admin reorder). `react-confetti` is for React level-complete overlays; `use-sound` is not used in Phaser games.

## Styling
- Tailwind v4: theme lives in CSS (`@import "tailwindcss"` + `@theme` in `src/app/index.css`). There is NO `tailwind.config.js`; never create one.
- Chrome pages share the `aura-*` theme (`src/app/aurora.css`). Never hand-roll new sky/white themes.
- Fonts: Fredoka only, loaded once in `index.html`. Never add a component-level Google Fonts `<link>`, never re-declare `.font-heading` / `.font-body`, never reference Nunito.
- Wrap new top-level surfaces in an `ErrorBoundary` (a failed lazy chunk must not blank the app).
- `SwitchPlayerButton` already exists in `BetaHome.jsx`; don't add another.

## Storage and env
- localStorage keys are namespaced and shared where the concept is shared (`ezwonders-player`, `ezw.gameAccess.v1`, `ezw.systemConfig.v1`, `ezw-muted-v1`). Reuse before adding.
- Frontend `.env` IS COMMITTED and must stay committed. It holds only the public `VITE_API_BASE_URL`; untracking it makes production fall back to localhost and the browser reports a misleading CORS error. Private values go in `.env.local` or the backend host env.

## Build and platform
- `vite.config.js` `manualChunks` must be a function (Vite 8 / rolldown rejects the object form).
- `vite-plugin-pwa` is used with `manifest: false`; `public/site.webmanifest` is hand-maintained. Phaser is excluded from precache; the API is never cached.
- Public routes: add to `INDEXABLE_ROUTES` in `src/seo/seo.jsx` AND `public/sitemap.xml`, or they are `noindex`.
- Content-heavy pages keep copy/imagery in a content file. NEVER rename `teacherOnboardingContent.js` to `teacherOnboarding.js` (case-only clash with the component breaks imports on Windows/macOS).

## Quality gates
- Vitest tests pure logic only (round generators, `mergeRows`, `nextScheduledGame`, `formatUnlockCountdown`, device fingerprint). No DOM/E2E suite.
- CI runs `npm ci` -> `npm audit --audit-level=high` -> lint -> test -> build; all must pass. Fix audit failures with `npm audit fix` (lockfile only). NEVER lower the audit level or add `|| true`: the auth credential lives in localStorage, so a vulnerable dependency is an exfiltration path.

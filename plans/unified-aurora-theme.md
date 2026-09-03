# Unified "Aurora" Theme — BetaHome Look Across All Pages

## Goal
Make every non-game screen share the same look as the current homepage
[`BetaHome.jsx`](../src/BetaHome.jsx) (the bright indigo → violet → magenta
"aurora" / soft-night scene). Scope is the *chrome* pages only — do NOT touch
React game content or Phaser game *content* (see Phaser carve-out below).

## Files in scope
| File | Lines | Type | Notes |
|------|------|------|-------|
| [`Home.jsx`](../src/Home.jsx) (`/`) | ~690 | classic home | oldest, light sky theme, dark text everywhere |
| [`NameGate.jsx`](../src/NameGate.jsx) | ~263 | login gate | light sky `#eaf8ff` login card; logged-in path returns children untouched |
| [`GameAccessPage.jsx`](../src/GameAccessPage.jsx) | 63 | route wrapper | "Teachers only" block is light-sky; otherwise renders panel |
| [`GameAccessPanel.jsx`](../src/GameAccessPanel.jsx) | ~1564 | class mgmt | page wrapper `bg-[#f5f7ff]` + huge light-white/slate surface with dark text |
| [`StatsPanel.jsx`](../src/StatsPanel.jsx) | ~1022 | teacher stats | white modal + dense slate tables, dark text |
| [`StudentBadge.jsx`](../src/StudentBadge.jsx) | ~530 | badge UI | **print artifact must stay light** |
| [`StudentLogin.jsx`](../src/StudentLogin.jsx) | 92 | `/p/:code` | tiny light-sky screen |
| Phaser `PhaserDemo`/scene backgrounds + in-game "home" buttons | — | games chrome | **content untouched**; only scene bg + home button restyled |

## Canonical theme spec (source of truth = BetaHome)
- **Page background** (dark indigo/purple aurora):
  `linear-gradient(160deg, #1e1b5a 0%, #4338ca 22%, #7c3aed 46%, #9333ea 66%, #a21caf 84%, #be185d 100%)`
  plus soft radial glows (violet/pink/indigo/cyan) and a faint white dot texture.
- **Surface / panel**: translucent dark glass — fill
  `rgba(255,255,255,0.10 → 0.16)`, `border white/15–25`, `backdrop-blur`,
  soft violet shadow. Dense data tables get a slightly more opaque dark
  surface (e.g. `rgba(23,18,43,0.45)` fill over `rgba(255,255,255,0.06)`)
  so long lists stay readable.
- **Text** (on the dark scene): primary `#f8fafc`, soft `#c7d2fe`, muted
  `#8795cf` — NOT slate-800/white-on-white.
- **Buttons/pills**: white text; gradient fills (violet
  `#9b51e0→#6d28d9→#2563eb`, mint `#2cd4bd→#16b3a6`, gold `#ffca28→#f59e0b`),
  `ring-white/60`. Ghost/secondary buttons become `white/10` fills with light
  text.
- **Accent gradient text** (headings): violet→pink `linear-gradient(135deg,#c4b5fd,#f9a8d4)` clipped to text.
- **Font**: Fredoka.

## Recommended architecture — shared theme, not per-file token edits
The chrome pages currently hard-code dozens of distinct `slate-*`/`white`/sky
classes. Editing every token by hand across ~4,000 lines is slow, error-prone,
and will drift between files. Instead:

1. **Add one shared CSS file** (e.g. `src/aurora.css`, imported from the pages
   or from `index.css`) exposing semantic utility classes that encapsulate the
   theme:
   - `.aura-page` — the fixed full-viewport aurora background layer (reuse the
     fixed-layer technique already proven in BetaHome so nothing rescales as
     content mounts) + scroll container color.
   - `.aura-panel`, `.aura-card`, `.aura-table`, `.aura-input`
   - `.aura-text`, `.aura-text-soft`, `.aura-text-muted`
   - `.aura-btn`, `.aura-btn--violet/mint/gold`, `.aura-ghost`, `.aura-chip`
   - `.aura-ring` / focus states
   These live next to the existing `bh-*` styles conceptually but are applied
   at the page/section level so per-file churn is mostly: swap the outer
   wrapper + panels + text color classes, leaving layout logic intact.
2. Convert **each page top-level wrapper** to `.aura-page` and its inner white
   surfaces to `.aura-panel`/`.aura-card`, then map `text-slate-*` → the aura
   text tokens and `bg-white`/`bg-slate-*` surfaces → dark glass equivalents.
3. Because the pages share these classes, later theme tweaks happen in one
   place.

> Note: BetaHome itself styles via inline JS constants and does not import
> `aurora.css`. Keep BetaHome as-is (it is the reference) and build
> `aurora.css` to *match* it so the two stay visually identical. Do not refactor
> BetaHome in this task.

## Per-file strategy
- **Home.jsx** — swap outer `bg-gradient ... #3FB6EA...` → `.aura-page`;
  header/cards/footer/panels → dark glass + light text. Keep structure,
  animations, padlock glyphs, and game cards (gradients already colorful).
- **NameGate.jsx** — logged-in path returns `children` untouched (good — no
  work when already in). Restyle only the login `<main>`/form card to the
  aurora background + dark glass card with light text. (Its light look only
  shows pre-login.)
- **GameAccessPage.jsx** — restyle the "Teachers only" non-teacher block to
  aurora; the main path renders GameAccessPanel unchanged.
- **GameAccessPanel.jsx** — swap page wrapper `bg-[#f5f7ff]` → `.aura-page`;
  sticky header already a dark gradient → align to aurora; convert the
  white/slate admin surfaces (K1/K2 rows, lock/shiny toggles, students list,
  settings) to `.aura-panel`/`.aura-card`/`.aura-table` with light text.
- **StatsPanel.jsx** — modal shell `bg-white` → `.aura-panel`; tables/rows and
  the "who's playing" dropdowns → dark glass surfaces with light text. This is
  the densest file — keep header gradient (pink→purple) which already fits the
  theme.
- **StudentBadge.jsx** — **only the surrounding chrome** (list row, "generate
  badge", print/download buttons). The actual `BadgeCard` printable card and
  its PDF rendering MUST stay light/sky — it is exported as PNG/PDF print media
  for physical badges.
- **StudentLogin.jsx** — small: swap `bg-[#eaf8ff]` wrapper → `.aura-page`,
  card → `.aura-panel`, text → light.

## Phaser carve-out (games chrome only)
Per instruction, edit **only**:
- Phaser scene **backgrounds** (the sky/backdrop color set on the scene),
- the in-game **"home"/back button**.
Do not change gameplay content, sprites/layout, or any BonusGames logic.
Locate the shared home-button/background handling (likely the base scene /
`PhaserDemo` / each game shell) and restyle those to the aurora. Because each
game may set its own scene background, target the common code path first, then
any per-game overrides.

## Sequencing
1. Add `src/aurora.css` shared theme classes (indigo/purple tokens above).
2. Home.jsx → NameGate.jsx → StudentLogin.jsx (smallest wins first).
3. GameAccessPage.jsx wrapper, then GameAccessPanel.jsx, then StatsPanel.jsx.
4. StudentBadge.jsx chrome only (protect the printable card).
5. Phaser scene backgrounds + home buttons.
6. Visual consistency pass across all converted pages + the two gates.

## Decisions to confirm
- **Stats/admin density**: admin tables on a dark purple scene will be dimmer
  than the current bright-white look. Confirm the semi-opaque dark-glass table
  surface above is acceptable (kept readable, not pitch black).
- **Classic Home (`/`)** is converted to the aurora too. If `Home` is meant to
  be retired in favour of `/beta-ezwonders`, converting it may be low-value —
  confirm it should still be restyled.
- **NameGate** only needs restyling if teachers/kids ever land on the login
  screen again; confirm we restyle it anyway for consistency.

# Adding a game

The whole process is **one folder + one registry entry**. Nothing else needs
editing — the route, the catalogue card and the homepage prefetch are all derived
from the registry.

## TL;DR

1. Create `src/games/<slug>/`.
2. Add one entry to `GAME_REGISTRY` in [`src/games/registry.js`](../src/games/registry.js).
3. Run `npm test && npm run lint && npm run build`.

That's it. An admin then adds the game to a class from the panel's **Catalogue**
(a class only ever sees games it has added).

---

## 1. Create the folder

```
src/games/<slug>/
```

- **React game** → a single `Game.jsx` exporting the page component as DEFAULT.
- **Phaser game** → `GamePage.jsx` + your scene files (`GameScene.js`,
  `StartScene.js`, `levels.js`, `assets.js`, …). `GamePage.jsx` is the page
  chrome; the scenes are the game. Copy an existing one as a starting point —
  [`feed-me-shapes`](../src/games/feed-me-shapes/GamePage.jsx) is a good Phaser
  template and [`count-and-win`](../src/games/count-and-win/Game.jsx) is a good
  React one.

Import everything with the `@/` alias (`@/ui/cn`, `@/auth/NameGate`, …). Relative
imports are only for files inside the same game folder.

### Wrapping the gates

Every game page must compose the two gates, in this order:

```jsx
export default function GamePage() {
  return (
    <NameGate gameLabel="Game 12: My Game">
      <GameAccessGate gameNumber={12} gameLabel="My Game">
        <GamePageInner />
      </GameAccessGate>
    </NameGate>
  );
}
```

`gameNumber` is the registry `key`; `gameLabel` must match the catalogue `label`.

## 2. Register it

Add **one** entry to `GAME_REGISTRY`:

```js
{
  key: '12',                       // stable identity — NEVER change or reuse
  slug: 'my-game',                 // the folder name, for humans
  route: '/12345',                 // opaque 5-digit, must be unique
  term: 4,                         // see GAME_TERMS
  progressKey: 'game12',           // must match logPlaySession({ game })
  meta: {
    emoji: '🎈',
    label: 'My Game',              // must be unique across the catalogue
    title: 'My Game',
    subtitle: 'What it teaches',
    description: 'One sentence for the card.',
    hue: '#0EA5E9',
    tint: '#E0F2FE',
    gradient: 'linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 55%, #0369A1 100%)',
    ring: 'ring-[#BAE6FD]',
  },
  load: () => import('@/games/my-game/GamePage'),
}
```

### Field notes

| Field | Why it matters |
| --- | --- |
| `key` | Primary key for unlocks, `GameAccess` rows and stats. Changing it orphans a class's access row, so treat it as immutable. |
| `route` | Deliberately an opaque code so a URL never reveals the game number. Must be unique; never reuse a retired one (old bookmarks would land on the wrong game). |
| `progressKey` | Read by the stats/progress tables. Must equal the `game` value the game passes to `logPlaySession`. |
| `term` | Which term group the card falls under. |
| `load` | The only line that differs between a React game (`Game.jsx`) and a Phaser game (`GamePage.jsx`) — it just has to resolve to a module whose default export is the page. |

## 3. Log play sessions

On completion, call:

```js
logPlaySession({ game: 'my-game', playerName, stars, totalRounds, peakStreak });
```

`game` must equal the registry entry's `progressKey`. Import it from
`@/api/logPlaySession`.

## 4. Audio (Phaser games)

Use the shared helpers — never a per-game copy:

```js
import { ensureBgMusic, addMuteButton } from '@/phaser/common/audioState';
```

Mute is a property of the player, stored under one shared `localStorage` key, so
a game must not roll its own.

## 5. Optional: a card icon

By default a card shows the catalogue `emoji`. To show art instead:

1. Drop `public/game-icons/<slug>.png` (square, transparent, < 150 KB — see the
   README in that folder).
2. Add one line to [`src/games/gameIcons.js`](../src/games/gameIcons.js):

```js
export const GAME_ICON_FILES = {
  '12': '/game-icons/my-game.png',
};
```

The path must be root-relative (`/game-icons/…`) so the cache header and the
service worker's runtime cache both cover it and it works offline.

---

## Things that are NOT part of adding a game

These are all derived from the registry — editing them is how the route, the card
and the unlock list drift apart:

- ❌ A `lazy()` import or `<Route>` in [`src/app/main.jsx`](../src/app/main.jsx)
- ❌ A hand-written entry in `GAME_CATALOG` (it is built from `GAME_REGISTRY`)
- ❌ A new line in BetaHome's prefetch list (it iterates the registry)

## Verifying

```bash
npm test        # pure-logic tests, must pass
npm run lint    # must be 0 errors
npm run build   # must succeed
```

Then check the game in the browser: it should appear in the panel Catalogue for
an admin to add, and once added, its card and route should both work.

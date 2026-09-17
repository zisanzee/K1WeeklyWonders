# Game icons

Drop one image per game here, then point it up in
`src/gameIcons.js` (`GAME_ICON_FILES`).

## Naming

Use the game's catalogue `key` from `GAME_CATALOG` in `src/gameAccess.js`:

| Game | key | Suggested filename |
| --- | --- | --- |
| Count & Win! | `1` | `game1.png` |
| Comparing Quantities | `2` | `game2.png` |
| Which Number? | `3` | `game3.png` |
| Compare Die and Dominoes | `4` | `game4.png` |
| Making & Splitting Groups | `5` | `game5.png` |
| Part-Part-Whole! | `6` | `game6.png` |
| Mama Bird's Eggs | `7` | `game7.png` |
| Pizza Order! | `8` | `game8.png` |
| Polly's Treasure Quest | `9` | `game9.png` |
| Feed Me Shapes | `10` | `game10.png` |
| Number Pop! (bonus) | `b1` | `bonus1.png` |

## Then register it

```js
// src/gameIcons.js
export const GAME_ICON_FILES = {
  '10': '/game-icons/game10.png',
};
```

A game with no entry just keeps showing its catalogue emoji, so this is
purely additive — nothing breaks for the games you haven't drawn yet.

## Format

- **Square, transparent PNG or WebP.** Cards render it inside a centred
  box, and a non-square image will be letterboxed by `object-contain`.
- **512×512 is plenty.** The biggest it is drawn is ~72px on a desktop card
  (retina ×2 = 144px), so anything above 512 is wasted bytes on every card.
  Aim for well under 150 KB each — shrink with a tool like Squoosh rather
  than shipping a multi-MB export.
- No need to add anything to `_headers`; `/game-icons/*` is already covered
  with a one-week cache in `public/_headers`.

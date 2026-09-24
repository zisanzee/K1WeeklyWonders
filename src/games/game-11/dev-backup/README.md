# Game 11 — dev part-editor backup

This folder is a **dormant backup** of the temporary in-page part editor that was
used to position the portrait parts. It is not imported by anything, so it never
loads for a player and never ships. It is kept here only so the tool can be
brought back quickly if another portrait pass is needed.

Files:
- `devEditor.js` — Phaser-free editor state (live overrides + copy-paste readout).
- `DevEditorPanel.jsx` — the React panel with x/y/scale/rotation/z sliders.

## What was removed from the live code when this was parked

To fully restore the editor, re-apply these four hooks (they were deliberately
small and all commented `DEV`):

1. **`src/games/game-11/GameScene.js`**
   - Import the editor helpers and add the flag:
     ```js
     import {
       update as devUpdate,
       select as devSelect,
       getSelected as devGetSelected,
       setRelayout as devSetRelayout,
     } from '@/games/game-11/devEditor';

     const DEV_EDITOR = import.meta.env.DEV;
     ```
   - In `create()`:
     ```js
     if (DEV_EDITOR) {
       this.input.keyboard.on('keydown', (e) => this.devKeyDown(e));
       globalThis.__G11_READ_VALUES__ = () => this.devSnapshot();
       devSetRelayout(() => this.devRelayout());
       this.events.once('shutdown', () => {
         devSetRelayout(null);
         if (globalThis.__G11_READ_VALUES__) delete globalThis.__G11_READ_VALUES__;
       });
     }
     ```
   - Restore the pointer hooks:
     - top of `onPointerDown`: `if (DEV_EDITOR && this.devPickPart(pointer)) return;`
     - top of `onPointerMove`: `if (this.devDrag) return this.devDragMove(pointer);`
     - top of `onPointerUp`: `if (this.devDrag) { this.devDrag = null; return; }`
   - Restore the `dev*` methods: `devTick`, `devPickPart`, `devDragMove`,
     `devRelayout`, `devKeyDown`, `devSnapshot`.
   - **Add the container handles** — `buildBoard()` keeps `this.originalContainer =
     original.container`, and `buildPortrait()` sets `container.pivot = pivot;`
     and `container.parts = partImages;` before returning. These are what the
     editor's hit-test and drag read.
   - In `buildBoard()`, or just hide the mirror by setting `SHOW_DUPLICATE_ALPHA`
     to a small value (e.g. `0.35`) while editing, then back to `0` after.

2. **`src/games/game-11/portraitPositions.js`**
   - `partTransform()` must merge the override global:
     ```js
     const overrides = typeof globalThis !== 'undefined' ? globalThis.__G11_OVERRIDES__ : null;
     const patch = overrides && overrides[textureKeyName];
     return patch ? { ...entry, ...patch } : entry;
     ```

3. **`src/games/game-11/Game.jsx`**
   - Mount the panel below the canvas in dev:
     ```jsx
     {import.meta.env.DEV ? <DevEditorPanel /> : null}
     ```
   - (It was lazily imported so it dropped out of the production bundle.)

4. **`devEditor.js` import paths** — the copies here import from
   `@/games/game-11/dev-backup/devEditor`. If you move them back to
   `src/games/game-11/`, update that path.

## Key format note

Portraits 1-8 use the compact key `p<portrait><variant><part>` (e.g. `p213`).
Portrait 10 needs two digits, which that form cannot express without colliding
(`p101` would read as portrait 1), so **portraits 9 and up use the delimited form
`p<portrait>v<variant>p<part>`** (e.g. `p10v1p2`). `portraits.js` `textureKey()`
and `assets.js` `parseTextureKey()` are the two ends of that rule; `keys.test.js`
covers it.

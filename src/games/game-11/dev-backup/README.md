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
       getOverride as devGetOverride,
       setRelayout as devSetRelayout,
     } from '@/games/game-11/dev-backup/devEditor';

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
   - Restore the `dev*` methods: `devPickPart`, `devDragMove`, `devRelayout`,
     `devRefreshSlots`, `devResortCopies`, `devKeyDown`, `devSnapshot`.
   - In `buildPortrait()` the returned container needs its `pivot` and `parts`
     (`container.pivot = pivot; container.parts = partImages;`) — these were kept
     in the live build, so nothing to restore there.
   - Confirm `SHOW_DUPLICATE = true` while editing and back to `false` after.

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

4. **`devEditor.js` import paths** — the copies here import from
   `@/games/game-11/dev-backup/devEditor`. If you move them back to
   `src/games/game-11/`, update that path.

## Tuning flags that were also switched off

In `GameScene.js`, these were part of the same tuning pass and are now off:
`DRAW_GUIDE_LINES`, `SHOW_DUPLICATE`, `DEV_ROUND_SKIP`, and the guide-line /
round-skip helpers. They can stay off for production.

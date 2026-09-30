# Game 12 — dev editor backup

This folder is a **dormant backup** of the temporary in-page editor used to
position the characters and their drop boxes. Nothing here is imported by
anything, so it never loads for a player and never ships. It is kept only so the
tool can be brought back quickly if another tuning pass is needed.

Files:
- `devEditor.js` — Phaser-free editor state (live overrides for characters AND
  boxes, selection + edit mode, copy-paste readouts).
- `DevEditorPanel.jsx` — the React sidebar with the Character / Box tabs and
  sliders.

The game is finalised: it always runs the real rounds, and the drop boxes are
never drawn. `sceneTuning.js` still carries the dormant live-table/override hooks
(`__G12_TUNING__`, `__G12_OVERRIDES__`, `__G12_BOX_OVERRIDES__`) so restoring the
editor needs no change there.

## To restore the editor

1. Move the two files back into `src/games/game-12/` and change
   `DevEditorPanel.jsx`'s import back to `@/games/game-12/devEditor`.

2. **`src/games/game-12/Game.jsx`** — mount the panel in dev:
   ```jsx
   import { lazy, Suspense } from 'react';
   const DevEditorPanel = import.meta.env.DEV
     ? lazy(() => import('@/games/game-12/DevEditorPanel'))
     : null;
   // …wrap <BaseGame> so the panel renders as a right-hand sidebar.
   ```

3. **`src/games/game-12/GameScene.js`** — re-add the dev hooks (all removed):
   - Import the editor helpers and `const DEV_EDITOR = import.meta.env.DEV;`.
   - In `create()`, expose the scene, wire HMR and start in preview:
     ```js
     if (DEV_EDITOR) {
       globalThis.__G12_GAME__ = this.game;
       this.game.events.on('g12:tuning', this.onTuning, this);
       globalThis.__G12_READ_VALUES__ = () => this.devSnapshot();
       devSetRelayout(() => this.devRelayout());
       this.input.keyboard.on('keydown', (e) => this.devKeyDown(e));
       this.previewIndex = 0; this.phase = 'preview'; this.setupPreview(0);
     } else { /* the start-screen path */ }
     ```
   - Restore `onTuning`, `setupPreview`, `devKeyDown`, `devPickPart`,
     `devDragMove`, `onDevPointerUp`, `devRelayout`, `devSnapshot` and the
     per-frame `update()` highlight.
   - Put the pick/drag branches back at the top of `onPointerDown/Move/Up`.
   - Bring back the box layer + selected-box highlight: a `boxLayer` graphics
     (`DEPTH_BOXES`), `this.selection` (`DEPTH_SELECTION`), the `devDrag` field,
     `drawBoxes()` (with `BOX_FILL`/`BOX_STROKE`/`BOX_SELECT_*`) and calls to it
     after each scene build. The box GEOMETRY (`computeBox`/`refreshBox`/`boxAt`)
     and the accept/reject logic in `onPointerUp` are still live — only the
     DRAWING was removed.

4. **`src/games/game-12/sceneTuning.js`** — already ready: `partTransform()` and
   `boxOverride()` merge `__G12_OVERRIDES__` / `__G12_BOX_OVERRIDES__`, and it
   still publishes the live tables. No change needed.

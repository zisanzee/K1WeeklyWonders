// src/devTuning/panel.js
// THE single DEV-gated loader for the shared tuning sidebar.
//
// WHY THIS FILE EXISTS: the dev panel must never be *shipped* to a player —
// not merely "not loaded". Vite only drops the panel's lazy chunk from a
// production build when `import.meta.env.DEV` appears LITERALLY in the SAME
// expression as the dynamic `import()`. So the gate lives here, on that exact
// expression, and nowhere else:
//
//   - Vite replaces `import.meta.env.DEV` with the literal `false`,
//   - `false && TUNING_DEV_ENABLED ? … : null` folds to `null`,
//   - the dynamic import() is dead code and its chunk is never emitted.
//
// DO NOT export a boolean like `export const DEV_PANEL = import.meta.env.DEV`
// and gate the import at a game's import site — that leaves the condition
// non-literal there, so the chunk is still EMITTED (only not loaded). Games use
// <DevTuningFrame> (DevTuningFrame.jsx), which consumes this module and adds no
// gate of its own.
import { lazy } from 'react';
import { TUNING_DEV_ENABLED } from './config';

export const DevTuningPanel =
  import.meta.env.DEV && TUNING_DEV_ENABLED
    ? lazy(() => import('./DevTuningPanel'))
    : null;

// src/devTuning/DevTuningFrame.jsx
// The one component a game mounts to get the live-tuning sidebar in dev.
//
// It owns BOTH the gate and the wrapper layout, so a game's Game.jsx stays a
// plain, always-valid element tree with no `if` at all:
//
//     <DevTuningFrame tuning={TUNING} schema={TUNING_SCHEMA}>
//       {game}
//     </DevTuningFrame>
//
// In production (or when TUNING_DEV_ENABLED is false) `DevTuningPanel` is null
// — the gate in panel.js has folded away — and this returns `children`
// untouched: no extra DOM, no Suspense, no import. See panel.js for why the
// gate must stay on the literal `import.meta.env.DEV` expression.
import { Suspense } from 'react';
import { DevTuningPanel } from './panel';

export default function DevTuningFrame({
  tuning,
  schema,
  layout = 'row',
  // Per-game LOCAL-DEV toggle: pass a game's own `TUNING_ENABLED` flag here to
  // hide the editor for one game while the shared switch stays on for others.
  // It is checked AFTER the build gate, so it can only ever hide the editor in
  // a dev build — it can never re-enable it in production.
  enabled = true,
  children,
}) {
  // No panel in this build → the game exactly as if the kit were not wired.
  if (!DevTuningPanel || !enabled) return children;

  const panel = (
    <Suspense fallback={null}>
      <DevTuningPanel tuning={tuning} schema={schema} />
    </Suspense>
  );

  // If the embedding layout is portrait / constrained, stacking (game on top,
  // panel below) is what fits; pass `layout="stack"` for that. Default is the
  // side-by-side desktop editor.
  if (layout === 'stack') {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="min-h-0 flex-1">{children}</div>
        {panel}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <div className="min-h-0 flex-1">{children}</div>
      {panel}
    </div>
  );
}

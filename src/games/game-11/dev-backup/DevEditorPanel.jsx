// DevEditorPanel.jsx  (BACKUP COPY — not imported by anything)
// Game 11 — temporary development editor UI.
//
// Renders below the game canvas and lets you select a part, drag/slider/nudge
// it, then copy the resulting numbers straight into portraitPositions.js.
//
// It talks to the scene through the Phaser-free bus in devEditor.js plus two
// globals the scene exposes: __G11_READ_VALUES__ (returns the current round's
// part list) and __G11_EDITOR_TICK__ (the scene bumps it to ask for a repaint).
// Nothing here ships.
//
// See README.md in this folder for how to restore the editor.
import { useCallback, useEffect, useState } from 'react';
import {
  subscribe,
  getSelected,
  select,
  getOverride,
  hasOverride,
  update,
  resetPart,
  resetAll,
  formatCode,
} from '@/games/game-11/dev-backup/devEditor';

// A labelled range that reports every move so the scene updates live.
function Slider({ label, value, min, max, step, onChange, suffix = '' }) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <span className="w-16 shrink-0 font-semibold">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-amber-600"
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 shrink-0 rounded border border-stone-300 px-1 py-0.5 text-right text-xs"
      />
      {suffix ? <span className="w-4 shrink-0 text-stone-400">{suffix}</span> : null}
    </label>
  );
}

export default function DevEditorPanel() {
  const [rows, setRows] = useState([]);
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);

  // Pull the current values from the scene. It owns the truth (code values +
  // any live overrides); we just mirror them for display.
  const read = useCallback(() => {
    const fn = globalThis.__G11_READ_VALUES__;
    setRows(fn ? fn() : []);
  }, []);

  useEffect(() => {
    // Deferred so the first read is not a synchronous setState inside the
    // effect body (which the React Compiler lint rule flags).
    const first = setTimeout(read, 0);
    // The scene calls this after a drag/nudge so the panel catches up.
    globalThis.__G11_EDITOR_TICK__ = read;
    const unsub = subscribe(() => force((n) => n + 1));
    const id = setInterval(read, 500); // safety poll across round changes
    return () => {
      unsub();
      clearTimeout(first);
      clearInterval(id);
      if (globalThis.__G11_EDITOR_TICK__ === read) delete globalThis.__G11_EDITOR_TICK__;
    };
  }, [read]);

  const selected = getSelected();
  const sel = rows.find((r) => r.key === selected);

  const nudge = (patch) => selected && update(selected, patch);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCode(rows.map((r) => r.key), (key) => {
        const row = rows.find((r) => r.key === key) || {};
        const override = getOverride(key);
        // Print code values, with this part's live override on top.
        return { ...row, ...override };
      }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border-t border-stone-300 bg-stone-100 p-3 font-mono text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold text-stone-800">DEV PART EDITOR</span>
        <span className="text-stone-500">
          drag a part on the canvas · Shift+arrows nudge · [ / ] change z
        </span>
        <button
          type="button"
          onClick={resetAll}
          className="ml-auto rounded border border-stone-400 px-2 py-0.5 font-semibold hover:bg-stone-200"
        >
          Reset all
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => select(row.key)}
            className={`rounded border px-2 py-1 ${
              row.key === selected
                ? 'border-amber-600 bg-amber-200 font-bold'
                : hasOverride(row.key)
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-300 bg-white'
            }`}
          >
            {row.key}
          </button>
        ))}
      </div>

      {sel ? (
        <div className="mt-3 grid max-w-2xl gap-1.5">
          <Slider
            label="x"
            value={sel.x}
            min={-200}
            max={920}
            step={1}
            onChange={(v) => nudge({ x: v })}
          />
          <Slider
            label="y"
            value={sel.y}
            min={-200}
            max={1280}
            step={1}
            onChange={(v) => nudge({ y: v })}
          />
          <Slider
            label="scale"
            value={sel.scale}
            min={0}
            max={4}
            step={0.01}
            onChange={(v) => nudge({ scale: v })}
          />
          <Slider
            label="rotation"
            value={sel.rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => nudge({ rotation: v })}
            suffix="°"
          />
          <Slider
            label="z"
            value={sel.z}
            min={0}
            max={20}
            step={1}
            onChange={(v) => nudge({ z: v })}
          />
          <button
            type="button"
            onClick={() => resetPart(selected)}
            className="mt-1 w-32 rounded border border-stone-400 px-2 py-1 font-semibold hover:bg-stone-200"
          >
            Reset {selected}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-stone-500">Tap a part on the canvas (or above) to edit it.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700"
        >
          {copied ? 'Copied!' : 'Copy portrait code'}
        </button>
        <span className="text-stone-500">paste into PORTRAIT_POSITIONS</span>
      </div>

      <pre className="mt-2 max-h-52 overflow-auto rounded border border-stone-300 bg-white p-2 leading-snug text-stone-800">
        {formatCode(rows.map((r) => r.key), (key) => {
          const row = rows.find((r) => r.key === key) || {};
          return { ...row, ...getOverride(key) };
        })}
      </pre>
    </div>
  );
}

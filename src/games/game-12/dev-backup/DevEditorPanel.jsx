// DevEditorPanel.jsx  (BACKUP COPY — not imported by anything)
// Game 12 — temporary development editor UI.
//
// Renders beside the game canvas. Pick a character (or its box), drag/slider/
// nudge it, then copy the resulting numbers straight into sceneTuning.js. Only
// mounted in dev (see Game.jsx), so nothing here ships.
//
// It talks to the scene through the Phaser-free bus in devEditor.js plus two
// globals the scene exposes: __G12_READ_VALUES__ (returns the current scene's
// character list, each row carrying its box as bx/by/bw/bh) and
// __G12_EDITOR_TICK__ (the scene bumps it to ask for a repaint).
import { useCallback, useEffect, useState } from 'react';
import {
  subscribe,
  getSelected,
  getMode,
  select,
  setMode,
  getOverride,
  hasOverride,
  update,
  resetPart,
  getBoxOverride,
  updateBox,
  resetBox,
  resetAll,
  formatCode,
  formatBoxCode,
} from '@/games/game-12/dev-backup/devEditor';

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
    const fn = globalThis.__G12_READ_VALUES__;
    setRows(fn ? fn() : []);
  }, []);

  useEffect(() => {
    // Deferred so the first read is not a synchronous setState inside the
    // effect body (which the React Compiler lint rule flags).
    const first = setTimeout(read, 0);
    // The scene calls this after a drag/nudge so the panel catches up.
    globalThis.__G12_EDITOR_TICK__ = read;
    const unsub = subscribe(() => force((n) => n + 1));
    const id = setInterval(read, 500); // safety poll across scene changes
    return () => {
      unsub();
      clearTimeout(first);
      clearInterval(id);
      if (globalThis.__G12_EDITOR_TICK__ === read) delete globalThis.__G12_EDITOR_TICK__;
    };
  }, [read]);

  const selected = getSelected();
  const mode = getMode();
  const sel = rows.find((r) => r.key === selected);

  const nudge = (patch) => selected && update(selected, patch);
  const nudgeBox = (patch) => selected && updateBox(selected, patch);

  const codeFor = (key) => {
    const row = rows.find((r) => r.key === key) || {};
    // Print code values, with this character's live override on top.
    return { ...row, ...getOverride(key) };
  };

  const boxCurrentFor = (key) => {
    const row = rows.find((r) => r.key === key) || {};
    return { x: row.bx, y: row.by, w: row.bw, h: row.bh };
  };
  const boxBaseFor = (key) => {
    const row = rows.find((r) => r.key === key) || {};
    return { ...{ x: row.bx, y: row.by, w: row.bw, h: row.bh }, ...getBoxOverride(key) };
  };

  const copy = async () => {
    const keys = rows.map((r) => r.key);
    const text = mode === 'box' ? formatBoxCode(keys, boxBaseFor, boxCurrentFor) : formatCode(keys, codeFor);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="h-full w-80 shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-100 p-3 font-mono text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-bold text-stone-800">DEV SCENE EDITOR</span>
        <button
          type="button"
          onClick={resetAll}
          className="ml-auto rounded border border-stone-400 px-2 py-0.5 font-semibold hover:bg-stone-200"
        >
          Reset all
        </button>
      </div>
      <p className="mb-2 text-stone-500">
        E = play/preview · ← / → change scene · drag on canvas · Shift+arrows nudge · [ / ] change z
      </p>

      {/* Character vs Box — which property the picker and sliders edit. */}
      <div className="mb-2 flex gap-1">
        {['part', 'box'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded border px-2 py-1 font-semibold ${
              mode === m ? 'border-sky-600 bg-sky-200 text-sky-900' : 'border-stone-300 bg-white'
            }`}
          >
            {m === 'part' ? 'Character' : 'Box (drop zone)'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {rows.map((row) => {
          const edited = mode === 'box' ? Object.keys(getBoxOverride(row.key)).length > 0 : hasOverride(row.key);
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => select(row.key, mode)}
              className={`rounded border px-2 py-1 ${
                row.key === selected
                  ? 'border-amber-600 bg-amber-200 font-bold'
                  : edited
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-300 bg-white'
              }`}
            >
              {row.key}
            </button>
          );
        })}
      </div>

      {sel ? (
        mode === 'box' ? (
          <div className="mt-3 grid max-w-2xl gap-1.5">
            <p className="text-stone-500">Drop box: accept zone for {selected}</p>
            <Slider label="box x" value={sel.bx} min={-400} max={1120} step={1} onChange={(v) => nudgeBox({ x: v })} />
            <Slider label="box y" value={sel.by} min={-400} max={1480} step={1} onChange={(v) => nudgeBox({ y: v })} />
            <Slider label="box w" value={sel.bw} min={20} max={720} step={1} onChange={(v) => nudgeBox({ w: v })} />
            <Slider label="box h" value={sel.bh} min={20} max={1080} step={1} onChange={(v) => nudgeBox({ h: v })} />
            <button
              type="button"
              onClick={() => resetBox(selected)}
              className="mt-1 w-40 rounded border border-stone-400 px-2 py-1 font-semibold hover:bg-stone-200"
            >
              Reset box {selected}
            </button>
          </div>
        ) : (
          <div className="mt-3 grid max-w-2xl gap-1.5">
            <p className="text-stone-500">Character transform: {selected}</p>
            <Slider label="x" value={sel.x} min={-400} max={1120} step={1} onChange={(v) => nudge({ x: v })} />
            <Slider label="y" value={sel.y} min={-400} max={1480} step={1} onChange={(v) => nudge({ y: v })} />
            <Slider label="scale" value={sel.scale} min={0} max={4} step={0.01} onChange={(v) => nudge({ scale: v })} />
            <Slider
              label="rotation"
              value={sel.rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(v) => nudge({ rotation: v })}
              suffix="°"
            />
            <Slider label="z" value={sel.z} min={0} max={20} step={1} onChange={(v) => nudge({ z: v })} />
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <span className="w-16 shrink-0 font-semibold">flipX</span>
              <input
                type="checkbox"
                checked={!!sel.flipX}
                onChange={(e) => nudge({ flipX: e.target.checked })}
                className="h-4 w-4 accent-amber-600"
              />
            </label>
            <button
              type="button"
              onClick={() => resetPart(selected)}
              className="mt-1 w-40 rounded border border-stone-400 px-2 py-1 font-semibold hover:bg-stone-200"
            >
              Reset {selected}
            </button>
          </div>
        )
      ) : (
        <p className="mt-3 text-stone-500">Tap a character on the canvas (or above) to edit it.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700"
        >
          {copied ? 'Copied!' : mode === 'box' ? 'Copy box code' : 'Copy scene code'}
        </button>
        <span className="text-stone-500">
          {mode === 'box' ? 'paste into CHARACTER_BOXES' : 'paste into CHARACTER_POSITIONS'}
        </span>
      </div>

      <pre className="mt-2 max-h-52 overflow-auto rounded border border-stone-300 bg-white p-2 leading-snug text-stone-800">
        {mode === 'box'
          ? formatBoxCode(rows.map((r) => r.key), boxBaseFor, boxCurrentFor)
          : formatCode(rows.map((r) => r.key), codeFor)}
      </pre>
    </div>
  );
}

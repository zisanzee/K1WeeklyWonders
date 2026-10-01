// src/devTuning/DevTuningPanel.jsx
// The shared dev-only tuning sidebar.
//
// Schema-driven: a game describes its controls as groups of sliders (and
// checkbox toggles), and this renders them, writes every change straight into
// the game's override store, and can copy the current values back out as
// source. It never imports a game directly — Game.jsx hands it the tuning
// instance, so the same panel serves every game.
//
// It is lazy-loaded and DEV-gated (see config.js), so it never reaches players.
import { useEffect, useState } from 'react';

// One labelled range + number pair, bound to a dotted path in the tuning tables.
function Slider({ label, path, value, min, max, step, suffix = '', onChange }) {
  const set = (v) => onChange(path, v);
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <span className="w-24 shrink-0 font-semibold">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-emerald-600"
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => set(Number(e.target.value))}
        className="w-20 shrink-0 rounded border border-stone-300 bg-white px-1 py-0.5 text-right text-xs text-stone-900"
      />
      {suffix ? <span className="w-4 shrink-0 text-stone-400">{suffix}</span> : null}
    </label>
  );
}

function Toggle({ label, path, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <span className="w-24 shrink-0 font-semibold">{label}</span>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(path, e.target.checked)}
        className="h-4 w-4 accent-emerald-600"
      />
    </label>
  );
}

// Turn a dotted path plus a value into the nested patch object set() expects.
function pathPatch(path, value) {
  const parts = path.split('.');
  let node = value;
  for (let i = parts.length - 1; i >= 0; i -= 1) node = { [parts[i]]: node };
  return node;
}

// Read a dotted path out of an object, with a fallback.
function readPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export default function DevTuningPanel({ tuning, schema }) {
  const [values, setValues] = useState(() => tuning.readAll());
  const [copied, setCopied] = useState(false);
  const [activeItem, setActiveItem] = useState(null); // '*' = All, else an item id
  const [nav, setNav] = useState(() => tuning.getNav());

  // Keep the display in step with the store (panel edits, on-canvas drags, HMR)
  // and the nav slot (scene/round changes poke the bus too).
  useEffect(() => {
    const sync = () => {
      setValues(tuning.readAll());
      setNav(tuning.getNav());
    };
    const first = setTimeout(sync, 0); // deferred: no sync setState in the effect
    const unsub = tuning.subscribe(sync);
    const id = setInterval(sync, 500);
    return () => {
      unsub();
      clearTimeout(first);
      clearInterval(id);
    };
  }, [tuning]);

  const onChange = (path, value) => {
    tuning.set(pathPatch(path, value));
    setValues(tuning.readAll());
  };

  // "All" scope for an array group: apply one field value to EVERY item at once.
  const setAllItems = (groupKey, path, value) => {
    const rows = values[groupKey] || [];
    const itemPatch = pathPatch(path, value);
    const patch = {};
    for (const r of rows) patch[r.id] = itemPatch;
    tuning.set({ [groupKey]: patch });
    setValues(tuning.readAll());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tuning.formatCode(schema.format));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  // An array group (e.g. CHARACTERS, BOXES, LANES) shows EVERY item as a grid:
  // an "All" button plus one button per item. Selecting a single item edits just
  // it (paths like `KEY.itemId.field`); "All" edits every item at once (the same
  // value written to each row). This is what lets a caller scope the editable
  // figures to one scene/round by handing a filtered array.
  const renderArrayGroup = (group) => {
    // A group may SCOPE its rows (e.g. to the scene/round chosen in the nav bar)
    // so the caller can make the editable figures specific to that scene/level.
    const all = values[group.key] || [];
    const rows = group.scope ? group.scope(all, nav) : all;
    if (rows.length === 0) {
      return (
        <div key={group.key} className="mt-2 rounded border border-stone-200 bg-white/60 p-2">
          <div className="font-bold text-stone-700">{group.label || group.key}</div>
          <p className="text-stone-500">Nothing in this scope.</p>
        </div>
      );
    }
    const active =
      activeItem && (activeItem === '*' || rows.some((r) => r.id === activeItem)) ? activeItem : rows[0].id;
    const showAll = active === '*';
    const viewRow = showAll ? rows[0] : rows.find((r) => r.id === active);

    return (
      <div key={group.key} className="mt-2 rounded border border-stone-200 bg-white/60 p-2">
        <div className="mb-1 font-bold text-stone-700">{group.label || group.key}</div>
        <div className="mb-1 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveItem('*')}
            className={`rounded border px-2 py-0.5 font-semibold ${
              showAll ? 'border-emerald-600 bg-emerald-200' : 'border-stone-300'
            }`}
          >
            All
          </button>
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveItem(r.id)}
              className={`rounded border px-2 py-0.5 font-semibold ${
                r.id === active ? 'border-emerald-600 bg-emerald-200' : 'border-stone-300'
              }`}
            >
              {group.itemLabel ? group.itemLabel(r) : `${group.key} ${r.id}`}
            </button>
          ))}
        </div>
        {(group.fields || []).map((f) => (
          <Slider
            key={f.path}
            label={f.label}
            path={f.path}
            value={readPath(viewRow, f.path)}
            min={f.min}
            max={f.max}
            step={f.step}
            suffix={f.suffix}
            onChange={
              showAll
                ? (_p, v) => setAllItems(group.key, f.path, v)
                : (_p, v) => onChange(`${group.key}.${active}.${f.path}`, v)
            }
          />
        ))}
      </div>
    );
  };

  const renderObjectGroup = (group) => (
    <div key={group.key} className="mt-2 rounded border border-stone-200 bg-white/60 p-2">
      <div className="mb-1 font-bold text-stone-700">{group.label || group.key}</div>
      {group.fields.map((f) =>
        f.type === 'toggle' ? (
          <Toggle
            key={f.path}
            label={f.label}
            path={`${group.key}.${f.path}`}
            value={readPath(values[group.key] || {}, f.path)}
            onChange={onChange}
          />
        ) : (
          <Slider
            key={f.path}
            label={f.label}
            path={`${group.key}.${f.path}`}
            value={readPath(values[group.key] || {}, f.path)}
            min={f.min}
            max={f.max}
            step={f.step}
            suffix={f.suffix}
            onChange={onChange}
          />
        )
      )}
    </div>
  );

  return (
    <div className="h-full w-96 max-w-[46vw] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-100 p-3 font-mono text-xs text-stone-800">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-bold text-stone-900">{schema.title || 'LIVE TUNING'}</span>
        <button
          type="button"
          onClick={() => {
            tuning.reset();
            setValues(tuning.readAll());
          }}
          className="ml-auto rounded border border-stone-400 px-2 py-0.5 font-semibold hover:bg-stone-200"
        >
          Reset all
        </button>
      </div>
      {schema.help ? <p className="mb-2 text-stone-600">{schema.help}</p> : null}

      {/* Optional per-game navigation (only when the schema opts in AND the
          scene registered nav handlers). Lets the panel step through scenes /
          rounds so the figure grids can show only the current one. */}
      {schema.nav && nav ? (
        <div className="mb-2 flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 p-2">
          {/* « » step whole scenes; ◀ ▶ step rounds. Scene buttons appear only
              when the game provides scene handlers. */}
          {nav.prevScene ? (
            <button
              type="button"
              onClick={() => nav.prevScene?.()}
              className="rounded border border-emerald-500 px-2 py-0.5 font-bold hover:bg-emerald-100"
              title="Previous scene"
            >
              «
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => nav.prev?.()}
            className="rounded border border-emerald-500 px-2 py-0.5 font-bold hover:bg-emerald-100"
            title="Previous round/level"
          >
            ◀
          </button>
          <span className="flex-1 text-center font-semibold text-emerald-800">
            {typeof nav.label === 'function' ? nav.label() : nav.label}
          </span>
          <button
            type="button"
            onClick={() => nav.next?.()}
            className="rounded border border-emerald-500 px-2 py-0.5 font-bold hover:bg-emerald-100"
            title="Next round/level"
          >
            ▶
          </button>
          {nav.nextScene ? (
            <button
              type="button"
              onClick={() => nav.nextScene?.()}
              className="rounded border border-emerald-500 px-2 py-0.5 font-bold hover:bg-emerald-100"
              title="Next scene"
            >
              »
            </button>
          ) : null}
        </div>
      ) : null}

      {schema.groups.map((group) =>
        group.type === 'array' ? renderArrayGroup(group) : renderObjectGroup(group)
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
        >
          {copied ? 'Copied!' : 'Copy tuning code'}
        </button>
        <span className="text-stone-500">{schema.copyHint || ''}</span>
      </div>

      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-stone-300 bg-white p-2 leading-snug text-stone-800">
        {tuning.formatCode(schema.format)}
      </pre>
    </div>
  );
}

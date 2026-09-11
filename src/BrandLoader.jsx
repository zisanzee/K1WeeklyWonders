import { ICON_URL } from './brand';

// The one loading screen used everywhere (app boot, route suspense, auth
// hydration, maintenance check, game-access wait). Kept dependency-free and
// animation-light so it paints instantly and costs nothing.
//
// IMPORTANT: this markup/background is mirrored by the inline loader in
// index.html (which shows before React has even loaded) — keep the two in sync.
const GRADIENT =
  'linear-gradient(160deg, #1e1b5a 0%, #4338ca 35%, #7c3aed 65%, #be185d 100%)';
// Matches the inline loader's font stack exactly, so handing off HTML → React
// never causes a visible font swap.
const LABEL_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The brand icon inside a spinning ring, so even a loading state already shows
// the app's face instead of a generic spinner. Mirrors `.boot-mark` in
// index.html — same box/icon sizes and the same slowed spin when the user has
// reduced motion enabled. `alt=""` because the label beside it is the real
// accessible text.
function BrandMark({ box, icon }) {
  return (
    <span className={`relative grid place-items-center ${box}`}>
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/60 border-t-transparent motion-reduce:[animation-duration:2s]"
      />
      <img
        src={ICON_URL}
        alt=""
        draggable={false}
        className={`${icon} rounded-[0.85rem] shadow-lg`}
      />
    </span>
  );
}

export default function BrandLoader({ label = 'EZ Wonders', inline = false }) {
  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <BrandMark box="h-12 w-12" icon="h-8 w-8" />
        <p
          className="text-xs font-black uppercase tracking-[0.25em] text-white/85"
          style={{ fontFamily: LABEL_FONT }}
        >
          {label}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 px-6"
      style={{ background: GRADIENT }}
    >
      <BrandMark box="h-16 w-16" icon="h-11 w-11" />
      <p
        className="text-sm font-black uppercase tracking-[0.25em] text-white/90"
        style={{ fontFamily: LABEL_FONT }}
      >
        {label}
      </p>
    </div>
  );
}

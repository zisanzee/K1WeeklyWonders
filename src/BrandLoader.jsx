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

export default function BrandLoader({ label = 'EZ Wonders', inline = false }) {
  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <span className="inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
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
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
      <p
        className="text-sm font-black uppercase tracking-[0.25em] text-white/90"
        style={{ fontFamily: LABEL_FONT }}
      >
        {label}
      </p>
    </div>
  );
}

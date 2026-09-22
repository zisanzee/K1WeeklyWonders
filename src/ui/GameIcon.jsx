import { useState } from 'react';
import { cn } from '@/ui/cn';
import { gameIconSrc } from '@/games/gameIcons';

// The one place a game icon is rendered. Shows the icon IMAGE when the game has
// one in gameIcons.js, and otherwise falls back to the catalogue emoji — so a
// game without art is never blank.
//
// `size` sizes the IMAGE only (a CSS length, default '1em'). The emoji fallback
// is NOT sized from it — it is styled by `emojiClassName`, which callers set to
// the exact text utilities the emoji used before this component existed
// (e.g. "text-5xl sm:text-6xl md:text-7xl"). Keeping the two independent is the
// point: an image is a box that scales cleanly to a pixel width, whereas an
// emoji IS a glyph and must be sized in text units, and the responsive
// breakpoint steps the old markup relied on can't be expressed as one width.
// Sizing the emoji from `size` (a font-size of '72%' or 'clamp(...)') is what
// would make a game with no art render its emoji at the wrong scale.
//
// The image is `loading="lazy"` + `decoding="async"`: the home grid can show
// every game at once, and lazy loading keeps off-screen icons out of the
// critical path on first paint. `onError` also falls back, so a registered icon
// whose file is missing or corrupt degrades to the emoji instead of a broken
// image.
export function GameIcon({
  game,
  emoji,
  size = '1em',
  className,
  imgClassName,
  emojiClassName,
  alt,
}) {
  const [failed, setFailed] = useState(false);
  const src = gameIconSrc(game);
  const fallbackEmoji = emoji ?? game?.emoji ?? '🎮';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        aria-hidden={alt ? undefined : 'true'}
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className={cn('inline-block select-none object-contain', imgClassName, className)}
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : 'true'}
      className={cn('inline-block leading-none', className, emojiClassName)}
    >
      {fallbackEmoji}
    </span>
  );
}

export default GameIcon;

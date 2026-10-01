// levels.js
// Position Mission! — the round script.
//
// Pure data (Phaser-free) so it can be unit-tested. Two rounds per scene, in
// scene order. Each round names ONE character to place; the prompt mixes words
// with little inline pictures (the character to move, and the thing it goes
// relative to).
//
//   scene   the scene this round belongs to (its texture-key id)
//   key     the texture key of the character the player must place
//   prompt  the instruction, written in a tiny markup the scene parses:
//             [textureKey]   an inline image (a texture key from assets.js)
//             {flip}         mirrors the IMMEDIATELY PRECEDING image (art only;
//                            never applied to words)
//             *word*         the relation word — drawn bigger + in the accent
//             |              a LINE BREAK (splits the prompt into stacked lines)
//             plain text     everything else
//
// The KEY's correct position/box is its tuned transform in sceneTuning.js, so
// there is no separate target table to keep in sync.

// The slide/bed/chef/tree inline pictures, and the occasional flipped character,
// are referenced by their texture keys (see assets.js IMAGES).
export const ROUNDS = [
  // ---- Scene 1 — the man is a permanent part of the scene -------------------
  { scene: 1, key: 'scene1Character4', prompt: 'Put [scene1Character4] in *front* of [scene1Character3]' },
  { scene: 1, key: 'scene1Character2', prompt: 'Put [scene1Character2] *behind* [scene1Character3]' },

  // ---- Scene 2 — the slide is a prop (background) --------------------------
  { scene: 2, key: 'scene2Character1', prompt: 'Put [scene2Character1] on *top* of [promptSlide]' },
  { scene: 2, key: 'scene2Character2', prompt: 'Put [scene2Character2] at the *bottom* of [promptSlide]' },

  // ---- Scene 3 — the woman is permanent; every pictured image is mirrored ----
  // ({flip} after an image flips THAT image only — the words stay upright.)
  { scene: 3, key: 'scene3Character1', prompt: 'Put [scene3Character1]{flip} in *front* of [scene1Character2]{flip}' },
  { scene: 3, key: 'scene3Character3', prompt: 'Put [scene1Character3]{flip} *behind* [scene1Character2]{flip}' },

  // ---- Scene 4 — the beds are a prop; the word says which bed --------------
  { scene: 4, key: 'scene4Character2', prompt: 'Put [scene4Character2] on the *top* [promptBed]' },
  { scene: 4, key: 'scene4Character1', prompt: 'Put [scene4Character1] on the *bottom* [promptBed]' },

  // ---- Scene 5 — the chef is a prop ---------------------------------------
  { scene: 5, key: 'scene5Character1', prompt: 'Put [scene5Character1] in *front* of [promptChef]' },
  { scene: 5, key: 'scene5Character2', prompt: 'Put [scene5Character2] *behind* [promptChef]' },

  // ---- Scene 6 — standard prompt, same position/style as every other scene ---
  { scene: 6, key: 'scene6Character1', prompt: 'Put [scene6Character1] on *top* of [promptTree]' },
  { scene: 6, key: 'scene6Character2', prompt: 'Put [scene6Character2] at the *bottom* of [promptTree]' },
];

export const TOTAL_ROUNDS = ROUNDS.length;

// Split a prompt into runs the scene lays out in a row: text runs (with an
// emphasis flag for the relation word — or a `flip` flag for a `word` the art
// should mirror) and image keys. Returns
//   [{ kind: 'text', text, emphasis, flip } | { kind: 'image', key }]
// so this module keeps knowing nothing about Phaser.
export function splitPrompt(prompt) {
  // One pass, capturing the markers: [image]  *emphasis*  {flip}  |
  const RX = /(\[[^\]]+\])|(\*[^*]+\*)|(\{flip\})|(\|)/g;
  const tokens = [];
  let last = 0;
  let m;

  const pushText = (raw) => {
    const text = raw.trim();
    if (text) tokens.push({ kind: 'text', text, emphasis: false, flip: false });
  };

  while ((m = RX.exec(prompt)) !== null) {
    pushText(prompt.slice(last, m.index));
    if (m[1]) {
      tokens.push({ kind: 'image', key: m[1].slice(1, -1), flip: false });
    } else if (m[2]) {
      tokens.push({ kind: 'text', text: m[2].slice(1, -1), emphasis: true, flip: false });
    } else if (m[3]) {
      // {flip} mirrors the IMMEDIATELY PRECEDING IMAGE (the mirrored art in
      // scene 3). It never flips text, and never flips a word.
      const prev = tokens[tokens.length - 1];
      if (prev && prev.kind === 'image') prev.flip = true;
    } else if (m[4]) {
      tokens.push({ kind: 'break' });
    }
    last = m.index + m[0].length;
  }
  pushText(prompt.slice(last));

  return tokens;
}

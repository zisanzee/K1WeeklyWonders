# NumbersVoice: Shared Number Audio Asset

## Goal

Place the `NumbersVoice` URL map (number-word → Cloudinary mp3) in a shared location under `src/` so that **every game** — both Phaser-based and React-based — can access and use it for number-specific voice playback.

## Proposed Location

**`src/Phaser/common/numbersVoice.js`**

This sits alongside existing shared utilities in `src/Phaser/common/`:
- [`src/Phaser/common/speech.js`](src/Phaser/common/speech.js) — shared `speak()` TTS helper
- [`src/Phaser/common/sceneAssets.js`](src/Phaser/common/sceneAssets.js) — shared canvas-drawn textures
- [`src/Phaser/common/starProgress.js`](src/Phaser/common/starProgress.js) — shared star display
- [`src/Phaser/common/uiHelpers.js`](src/Phaser/common/uiHelpers.js) — shared UI button helpers

## What the Module Exports

```js
export const NUMBERS_VOICE = { ... }           // Raw URL map (word → url)
export const NUMBERS_VOICE_MANIFEST            // Pre-formatted for BasePreloadScene
export function playNumberVoice(scene, number, muted) {}  // Phaser scene helper
export function getNumberVoiceUrl(number) {}               // React game helper
```

### 1. `NUMBERS_VOICE` — raw URL map

The exact object from the user, keyed by number word (`'one'`..`'ten'`).

### 2. `NUMBERS_VOICE_MANIFEST` — pre-formatted asset manifest array

An array of `{type: 'audio', key, url}` objects ready to be spread into a `BasePreloadScene`'s asset manifest. Example usage:

```js
// In a game's assets.js:
import { NUMBERS_VOICE_MANIFEST } from '../../Phaser/common/numbersVoice';
export const ASSET_MANIFEST = [
  { type: 'image', key: 'background', url: IMAGES.background },
  ...NUMBERS_VOICE_MANIFEST,
  // ... other audio/image entries
];
```

### 3. `playNumberVoice(scene, number, muted)` — Phaser helper

Plays a pre-loaded number voice clip through the Phaser sound manager.

- `scene` — a Phaser.Scene instance (must have the audio key loaded)
- `number` — integer (1-10) or string (`'one'`..`'ten'`)
- `muted` — if true, no playback
- Stops any previous number voice before starting a new one (same pattern as [`BonusGame1/speech.js`](src/BonusGames/BonusGame1/speech.js))

### 4. `getNumberVoiceUrl(number)` — React helper

Returns the Cloudinary URL for a given number. Handy for React-based games (Game1, Game2, etc.) that want to use the `use-sound` hook or `new Audio()` directly.

```js
import { getNumberVoiceUrl } from '../../Phaser/common/numbersVoice';
const url = getNumberVoiceUrl(3); // returns the 'three' mp3 URL
```

## Consumption Patterns

### Phaser-based games (BonusGame1, Game4, etc.)

**Step 1:** Import the manifest and add to the game's asset list:

```js
// src/BonusGames/GameX/assets.js
import { NUMBERS_VOICE_MANIFEST } from '../../Phaser/common/numbersVoice';

export const ASSET_MANIFEST = [
  // ... game-specific assets
  ...NUMBERS_VOICE_MANIFEST,
];
```

Audio keys will be `'voice-one'`, `'voice-two'`, ..., `'voice-ten'`.

**Step 2:** Play a number's voice from any scene:

```js
import { playNumberVoice } from '../../Phaser/common/numbersVoice';

// In a scene method:
playNumberVoice(this, 5, isMuted);
// or
playNumberVoice(this, 'three', isMuted);
```

### React-based games (Game1, Game2, etc.)

```js
import { getNumberVoiceUrl } from '../../Phaser/common/numbersVoice';
import useSound from 'use-sound';

function MyGame() {
  const [play] = useSound(getNumberVoiceUrl(3));
  // ...
  <button onClick={play}>Say "three"</button>
}
```

Or using plain `Audio`:

```js
import { getNumberVoiceUrl } from '../../Phaser/common/numbersVoice';
const audio = new Audio(getNumberVoiceUrl(targetNumber));
audio.play();
```

## What to implement

1. **Create** [`src/Phaser/common/numbersVoice.js`](src/Phaser/common/numbersVoice.js) with the 4 exports above.
2. **No other files need modification** — each game opts in by importing the module.

## File to create

| File | Purpose |
|------|---------|
| [`src/Phaser/common/numbersVoice.js`](src/Phaser/common/numbersVoice.js) | Shared URL map, manifest, and helpers |

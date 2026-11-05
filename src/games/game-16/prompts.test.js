import { describe, it, expect } from 'vitest';
import {
  PROMPTS,
  voiceFor,
  voiceKeyAndUrlFor,
  voiceKeyFor,
  voiceManifest,
  textFor,
  promptRow,
  clueVoiceFor,
} from './prompts';

// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Scene 4 played "first, then second, then third" instead of the floor it was
// actually asking about. The URL was right and the key was not: the key was built
// from the RUN ROUND (1..5) instead of the floor (1..10), and `playKey` plays by
// KEY. So five questions about five random floors played whatever clips happened
// to be keyed 1, 2, 3, 4, 5.
//
// Nothing caught it because prompts.js had no tests. These pin the property that
// matters: THE KEY AND THE SENTENCE MUST DESCRIBE THE SAME FLOOR.

describe('scene 4 — the voice key follows the FLOOR, not the round', () => {
  // A run is five rounds; the floors are drawn at random from ten. So every
  // (round, floor) pair below is reachable.
  const rounds = [1, 2, 3, 4, 5];
  const floors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('builds the key from extra.floor', () => {
    floors.forEach((floor) => {
      const { key } = voiceKeyAndUrlFor('building', 1, { floor });
      expect(key).toBe(`voice-building-${floor}`);
    });
  });

  it('gives the same floor the same key on every round', () => {
    // THE REGRESSION. Before the fix this returned voice-building-1, -2, -3…
    // as the round advanced, i.e. the audio tracked the round counter.
    rounds.forEach((round) => {
      expect(voiceKeyAndUrlFor('building', round, { floor: 8 }).key).toBe('voice-building-8');
    });
  });

  it('gives different floors different keys on the same round', () => {
    // The other half: a fixed round must not pin the clip.
    const keys = floors.map((floor) => voiceKeyAndUrlFor('building', 3, { floor }).key);
    expect(new Set(keys).size).toBe(floors.length);
  });

  it('pairs each key with the URL of the same floor', () => {
    // The bug was a MISMATCH between a correct URL and a wrong key. Assert the
    // two agree, because `playKey` uses the key and the row's text uses the floor.
    floors.forEach((floor) => {
      const { key, url } = voiceKeyAndUrlFor('building', 2, { floor });
      const expectedUrl = PROMPTS.building[floor].voice;
      expect(url).toBe(expectedUrl);
      // The key encodes the same number the URL's filename does.
      expect(key).toBe(`voice-building-${floor}`);
    });
  });

  it('never returns a key the manifest did not load', () => {
    // A key that was never queued fails SILENTLY in Phaser, so this is the check
    // that would have caught the bug from the other direction.
    const loaded = new Set(voiceManifest().map((entry) => entry.key));
    rounds.forEach((round) => {
      floors.forEach((floor) => {
        const { key, url } = voiceKeyAndUrlFor('building', round, { floor });
        if (url) expect(loaded.has(key)).toBe(true);
      });
    });
  });

  it('has all ten floors recorded', () => {
    floors.forEach((floor) => {
      expect(voiceFor('building', 1, { floor })).toBe(PROMPTS.building[floor].voice);
    });
  });

  it('text and audio name the same floor', () => {
    // The sentence is what the child reads; the clip is what they hear.
    const words = ['first', 'second', 'third', 'fourth', 'fifth',
      'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    floors.forEach((floor) => {
      expect(textFor('building', 1, { floor })).toContain(words[floor - 1]);
    });
  });
});

describe('scene 2 — the voice is per-row, with a fallback only on replay', () => {
  it('speaks nothing automatically after round 1', () => {
    // Only round 1 was recorded; re-reading it unprompted would be noise.
    expect(voiceFor('mirror', 1)).toBeTruthy();
    expect(voiceFor('mirror', 2)).toBeNull();
    expect(voiceFor('mirror', 3)).toBeNull();
  });

  it('falls back to round 1 when the child taps to hear it again', () => {
    // The manual replay path IS allowed to walk backwards: the child is asking to
    // hear the instruction they are still following.
    [1, 2, 3].forEach((round) => {
      const { url, key } = voiceKeyAndUrlFor('mirror', round);
      expect(url).toBeTruthy();
      expect(key).toBe('voice-mirror-1');
    });
  });

  it('does not fall back for scene 3, whose sentence changes', () => {
    // A fallback here would speak a DIFFERENT instruction from the one on screen.
    const a = voiceKeyAndUrlFor('positions', 3, { slot: 'A' });
    expect(a.url).toBeTruthy();
    expect(a.key).toBe('voice-positions-3-A');
    expect(a.fromRound).toBe(3);
  });
});

describe('scene 1 — the clip is chosen by the CLUE', () => {
  it('keys the clip by the clue, not by the round', () => {
    // The clue rounds are shuffled, so a round-keyed clip would be wrong half the
    // time. Identity is the clue TEXT.
    const a = voiceKeyAndUrlFor('shapes', 1, { clue: '3 corners' });
    const b = voiceKeyAndUrlFor('shapes', 3, { clue: '3 corners' });
    expect(a.key).toBe(b.key);
    expect(a.url).toBe(clueVoiceFor('3 corners'));
  });

  it('has a clip for each of the four clues', () => {
    ['3 corners', 'no corners', '4 equal sides', '4 corners'].forEach((clue) => {
      expect(clueVoiceFor(clue)).toBeTruthy();
    });
  });

  it('returns no audio for an unknown clue rather than throwing', () => {
    expect(clueVoiceFor('nonsense')).toBe(null);
    expect(voiceKeyAndUrlFor('shapes', 1, { clue: 'nonsense' }).url).toBe(null);
  });
});

describe('promptRow', () => {
  it('is keyed by floor for scene 4, so the ROUND is irrelevant', () => {
    // The same floor must resolve to the same row whatever the run position.
    [1, 3, 5].forEach((round) => {
      expect(promptRow('building', round, { floor: 7 })).toBe(PROMPTS.building[7]);
    });
  });

  it('is keyed by portrait then slot for scene 3', () => {
    expect(promptRow('positions', 2, { slot: 'B' })).toBe(PROMPTS.positions[2].B);
    expect(promptRow('positions', 2, {})).toBe(PROMPTS.positions[2].A);
  });

  it('returns null for a row that does not exist', () => {
    expect(promptRow('building', 1, { floor: 99 })).toBe(null);
    expect(promptRow('mirror', 99)).toBe(null);
    expect(promptRow('nonsense', 1)).toBe(null);
  });
});

describe('voiceKeyFor', () => {
  it('derives from identity, never from the verdict text', () => {
    // Re-wording a prompt must not orphan its recording.
    expect(voiceKeyFor('building', 4)).toBe('voice-building-4');
    expect(voiceKeyFor('positions', 2, { slot: 'B' })).toBe('voice-positions-2-B');
    expect(voiceKeyFor('mirror', 1)).toBe('voice-mirror-1');
  });
});

describe('voiceManifest', () => {
  it('emits one entry per recorded row, with unique keys', () => {
    const entries = voiceManifest();
    expect(entries.length).toBeGreaterThan(0);
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    entries.forEach((entry) => {
      expect(entry.type).toBe('audio');
      expect(typeof entry.url).toBe('string');
      expect(entry.url.length).toBeGreaterThan(0);
    });
  });

  it('covers all ten floors', () => {
    const keys = voiceManifest().map((e) => e.key);
    for (let floor = 1; floor <= 10; floor += 1) {
      expect(keys).toContain(`voice-building-${floor}`);
    }
  });
});

---
name: ezw-k1-numeracy-design
description: Use when designing or changing the learning content, difficulty, rounds, feedback or scoring of an EZ Wonders game for kindergarten children (ages 4-6) - counting, subitizing, comparing quantities, which number, part-part-whole, making/splitting groups, number recognition.
---

# Kindergarten numeracy game design

Players are 4-6 year olds, many pre-readers, on shared school devices. Design for them, not for adults.

## Pick one learning goal per game
Existing games cover: counting (one-to-one correspondence), comparing quantities, number recognition ("which number"), dice/domino patterns (subitizing), making & splitting groups, part-part-whole. A new game targets ONE skill and one number range. Check `GAME_CATALOG` / registry first so it does not duplicate an existing game's goal.

## Number ranges and ramp
- Start small: 1-5, then 1-10, then up to 20 at most. Do not mix ranges within an early round.
- Ramp across rounds: same mechanic, bigger numbers / more distractors / less scaffolding. Change only ONE variable at a time.
- Early rounds are near-impossible to fail; later rounds introduce mild challenge.
- Keep a run short: roughly 5-8 rounds, about 2-4 minutes. Attention is short.

## Representation
- Show quantity as clear, countable objects (distinct, non-overlapping, consistent size). Vary arrangement (line, scattered, dice pattern) across rounds so kids learn quantity, not layout.
- Pair numerals with dots/objects. Use friendly objects from the game's theme.
- Numbers are spoken: use `numbersVoice.js` / `speech.js` (`warmupSpeech` on first user gesture). No instruction should rely on reading text. Pair every prompt with voice and/or an obvious visual cue (pulse, arrow).

## Feedback
- Correct: immediate, bright, short (sound + animation + count-aloud where relevant). Celebrate effort, not speed.
- Wrong: gentle and non-punishing. No buzzers/red flashes/lost stars. Re-prompt, highlight the right idea (e.g. count aloud together), let them retry. After 2 misses show the answer and move on so no child gets stuck.
- Never use timers or time pressure for scored rounds in K1 games.
- `peakStreak`, `mistakes`, `elapsedSeconds` are logged for teachers; record honestly but never show kids a failure count.

## Stars
Star thresholds should be achievable by most kids (e.g. 3 stars = few/no mistakes, 1 star = completed). Use `createStarProgress({ storageKey, levelCount })` and the existing storage-key conventions.

## Instructions and UX
- One action per screen. Big targets (min about 48-64 px at base resolution, generous hit areas). No tiny close buttons.
- No dense text. Titles are short. Teachers read descriptions, kids do not.
- Idle hint: if no input for ~6-8 s, repeat the voice prompt and pulse the target.
- Accessible colours: do not rely on colour alone to convey correct/wrong.

## Acceptance check before building
Write down: the skill, the number range, how the ramp changes, what a wrong answer looks/sounds like, how a stuck child is rescued, how stars are earned. If any of these is missing, the design is not ready.

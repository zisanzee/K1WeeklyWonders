// GameScene.js
// Main game scene for Game 7 — Number Bonds ("Mama Bird's Eggs").
// Children drag eggs from a bottomless basket into two nests (blue & yellow)
// so the total eggs across both nests equals the round's target number.
//
// 4 levels alternating split/fill mode, two birds (Robin / Owl), two
// number ranges (1-5 / 1-10). All level parameters come from levels.js;
// the scene itself is level-agnostic.

import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { LEVELS, buildRounds, progress } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';
import { playNumberVoice } from '../../Phaser/common/numbersVoice';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EGG_TINTS = [0xff6fa5, 0xffd23f, 0x6fd66f, 0xa06fe0]; // pink, yellow, green, purple
const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const BASKET_EGG_COUNT = 3; // 3 fixed slots in the basket
const BASKET_SLOT_GAP = 80; // horizontal gap between each basket egg slot
const BASKET_SNAP_RADIUS_FACTOR = 0.14; // fraction of width for basket drop-zone
const CORRECT_VOICES = ['vo-correct-1', 'vo-correct-2', 'vo-correct-3'];
const TRY_AGAIN_VOICES = ['vo-try-again-1', 'vo-try-again-2'];

// ---------------------------------------------------------------------------
// Safe voice playback helper
// ---------------------------------------------------------------------------

function playVoice(scene, key, onComplete) {
  if (!scene.cache.audio.exists(key)) {
    console.warn(`playVoice(): "${key}" not loaded, skipping.`);
    if (onComplete) onComplete();
    return null;
  }
  // Stop any previous voice (from either system) so only one plays at a time.
  if (scene.currentVoice) {
    scene.currentVoice.stop();
    scene.currentVoice.destroy();
    scene.currentVoice = null;
  }
  if (window.__currentNumberVoice) {
    window.__currentNumberVoice.stop();
    window.__currentNumberVoice.destroy();
    window.__currentNumberVoice = null;
  }
  const sound = scene.sound.add(key);
  sound.once('complete', () => {
    sound.destroy();
    scene.currentVoice = null;
    if (onComplete) onComplete();
  });
  sound.play();
  scene.currentVoice = sound;
  return sound;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  // -----------------------------------------------------------------------
  // 4.1 init
  // -----------------------------------------------------------------------

  init(data) {
    this.levelIndex = data?.levelIndex ?? 0;
    this.level = LEVELS[this.levelIndex];
    this.rounds = buildRounds(this.level);
    this.roundIndex = 0;
    this.blueSlots = [];
    this.yellowSlots = [];
    this.basketEggs = [];
    this.interactiveEggs = []; // all eggs the child can drag (excludes fill-mode locked ones)
    this.isCorrectAnimating = false; // gates double-taps during correct feedback
    this.isHintAnimating = false;    // gates double-taps on hint
  }

  // -----------------------------------------------------------------------
  // 4.3 create() — build order follows the spec
  // -----------------------------------------------------------------------

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;
    this.stopSpeechOnShutdown();

    // 1. Background
    const bg = this.add.image(width / 2, 0, 'background').setOrigin(0.5, 0).setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);

    // 2. Bird sprite — perched top-right area, gentle float tween.
    //    Depth is high so it always renders above eggs (even during drag at depth 50).
    const birdKey = this.level.bird;
    this.bird = this.add.image(width - 130, height * 0.24, birdKey).setDepth(55).setScale(0.65);
    this.bird.setOrigin(0.5);
    this.birdFloatTween = this.tweens.add({
      targets: this.bird,
      y: this.bird.y + 8,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 3. Instruction banner — moved down to avoid overlap with mute button
    const bannerText = this.level.mode === 'split'
      ? 'Split the eggs \n between the nests!'
      : 'Finish filling the nests!';
    this.add.text(width / 2,64, bannerText, {
      fontSize: Math.min(48, width * 0.1),
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 7,
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5).setDepth(20);

    // 4. Round indicator (top-right pill)
    this.roundPill = this.createPillButton(width - 16, 16, `Round ${this.roundIndex + 1}/${this.rounds.length}`, {
      fontSize: '16px',
      paddingX: 12,
      paddingY: 7,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // 5. Star counter (top-right, below round indicator)
    this.createPillButton(width - 16, 52, `\u2B50 ${progress.totalStars()}/${LEVELS.length}`, {
      fontSize: '16px',
      paddingX: 12,
      paddingY: 7,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // 6. Target banner — built fresh per round in setupRound().
    this.targetBanner = null;
    this.highlightNum = null;

    // 7. Build nest slot grids
    this.buildNestGrids();

    // 8. Basket
    this.buildBasket();

    // 9. Buttons
    this.buildButtons();

    // 10. Stop any in-progress voice when leaving this scene
    // (e.g. pressing Home or going to Level Select mid-voice).
    this.events.on('shutdown', () => {
      if (this.currentVoice) {
        this.currentVoice.stop();
        this.currentVoice.destroy();
        this.currentVoice = null;
      }
      if (window.__currentNumberVoice) {
        window.__currentNumberVoice.stop();
        window.__currentNumberVoice.destroy();
        window.__currentNumberVoice = null;
      }
    });

    // 11. Mute
    addMuteButton(this, 16, 16, { anchor: 'topLeft' });
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));

    // 11. Set up the first round
    this.setupRound();
  }

  // -----------------------------------------------------------------------
  // Nest grid construction
  // -----------------------------------------------------------------------

  buildNestGrids() {
    const { width, height } = this.scale;
    const [, max] = this.level.range;
    const cols = Math.min(5, max);
    const rows = Math.ceil(max / 5);

    // Larger nests — more width, bigger scale
    const nestWidth = Math.min(380, width * 0.48);
    const slotSize = Math.min(46, (nestWidth - 36) / cols);
    // More horizontal breathing room between slots; vertical gap is wider
    // for owl levels (2 rows of 5) so they don't feel cramped.
    const gapX = 8;
    const gapY = max >= 10 ? 18 : 8;

    const gridPixelW = cols * (slotSize + gapX) - gapX;
    const gridPixelH = rows * (slotSize + gapY) - gapY;

    // Nests moved lower (nestTop increased), more room below for nests
    const nestTop = 200;
    const nestAreaH = height - nestTop - 190; // room for basket + buttons
    const totalGridH = gridPixelH;
    const nestAreaOffset = nestAreaH > totalGridH
      ? (nestAreaH - totalGridH) / 2
      : 0;

    const nestY = nestTop + nestAreaOffset + gridPixelH / 2;

    // Nest image scale — bigger than before
    const nestScale = Math.min(nestWidth / 320, nestAreaH / 240);

    // Store nestY for target banner positioning
    this.nestTop = nestTop;
    this.nestCenterY = nestY;

    // -- Blue Nest (left) --
    const blueX = width / 2 - nestWidth / 2 - 12;
    this.add.image(blueX, nestY, 'blue-nest').setDepth(1).setScale(nestScale);
    // Nest text labels removed — no "Blue Nest" / "Yellow Nest" text
    this.blueSlots = this.makeSlots(blueX, nestY, cols, rows, slotSize, gapX, gapY, gridPixelW, gridPixelH);

    // -- Yellow Nest (right) --
    const yellowX = width / 2 + nestWidth / 2 + 12;
    this.add.image(yellowX, nestY, 'yellow-nest').setDepth(1).setScale(nestScale);
    this.yellowSlots = this.makeSlots(yellowX, nestY, cols, rows, slotSize, gapX, gapY, gridPixelW, gridPixelH);

    // Draw faint slot circles on top of nest art.
    this.drawSlotCircles(this.blueSlots);
    this.drawSlotCircles(this.yellowSlots);
  }

  makeSlots(centerX, centerY, cols, rows, slotSize, gapX, gapY, gridPixelW, gridPixelH) {
    const slots = [];
    const startX = centerX - gridPixelW / 2 + slotSize / 2;
    const startY = centerY - gridPixelH / 2 + slotSize / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({
          x: startX + c * (slotSize + gapX),
          y: startY + r * (slotSize + gapY),
          occupiedBy: null, // egg game object or null
          locked: false,    // fill-mode eggs that cannot be moved
        });
      }
    }
    return slots;
  }

  drawSlotCircles(slots) {
    slots.forEach((slot) => {
      const circle = this.add.graphics().setDepth(2);
      circle.lineStyle(2, 0xffffff, 0.35);
      circle.strokeCircle(slot.x, slot.y, 14);
    });
  }

  // -----------------------------------------------------------------------
  // Basket — 3 fixed egg slots in the center
  // -----------------------------------------------------------------------

  buildBasket() {
    const { width, height } = this.scale;
    const basketY = height - 175;
    const basketX = width / 2;

    // Basket image at previous (smaller) scale
    this.add.image(basketX, basketY, 'egg-basket').setDepth(3).setScale(1.2);

    // Store basket position for egg-origin tracking.
    this.basketPos = { x: basketX, y: basketY };

    // 3 fixed slot positions, evenly spaced across the center of the basket.
    // Eggs sit slightly above the basket image's center so they look nestled in.
    this.basketSlots = [];
    for (let i = 0; i < BASKET_EGG_COUNT; i++) {
      const ox = -BASKET_SLOT_GAP + i * BASKET_SLOT_GAP;
      this.basketSlots.push({ x: basketX + ox, y: basketY - 18 });
    }

    // Spawn one egg per slot (each pops in).
    for (let i = 0; i < BASKET_EGG_COUNT; i++) {
      this.spawnBasketEgg(i, true);
    }
  }

  // Creates one draggable egg at the given basket slot index.
  // `popIn` — starts at scale 0 and bounces up.
  spawnBasketEgg(slotIndex, popIn) {
    const slot = this.basketSlots[slotIndex];
    const egg = this.add.image(slot.x, slot.y, 'egg').setDepth(4);
    egg.setScale(popIn ? 0 : 0.13);
    egg.setTint(pickRandom(EGG_TINTS));
    egg.setData('origin', { type: 'basket' });
    egg.setData('basketSlotIndex', slotIndex);
    this.makeDraggable(egg);

    if (popIn) {
      this.tweens.add({
        targets: egg,
        scale: 0.13,
        duration: 350,
        ease: 'Back.easeOut',
      });
    }

    this.basketEggs.push(egg);
    this.interactiveEggs.push(egg);
    return egg;
  }

  // Replaces an egg at a specific basket slot (the one that was just taken).
  replenishBasket(slotIndex) {
    this.time.delayedCall(200, () => {
      if (!this.scene.isActive()) return;
      this.spawnBasketEgg(slotIndex, true);
    });
  }

  // -----------------------------------------------------------------------
  // Drag & drop (4.4)
  // -----------------------------------------------------------------------

  makeDraggable(egg) {
    egg.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(egg);

    egg.on('drag', (_pointer, dragX, dragY) => {
      egg.x = dragX;
      egg.y = dragY;
      egg.setDepth(50); // above everything while being dragged
    });

    egg.on('dragend', () => {
      this.onEggDragEnd(egg);
    });
  }

  // Find an empty basket slot index, or -1 if all are occupied.
  findEmptyBasketSlot() {
    const occupiedIndices = new Set(this.basketEggs.map((e) => e.getData('basketSlotIndex')));
    for (let i = 0; i < BASKET_EGG_COUNT; i++) {
      if (!occupiedIndices.has(i)) return i;
    }
    return -1;
  }

  onEggDragEnd(egg) {
    egg.setDepth(4); // restore normal depth
    const origin = egg.getData('origin');

    // First check: nearest empty nest slot?
    const nearestNestSlot = this.findNearestEmptySlot(egg.x, egg.y);
    if (nearestNestSlot) {
      // Free previous nest-slot location.
      if (origin?.type === 'slot') {
        origin.slot.occupiedBy = null;
        origin.slot.locked = false;
      }

      // Occupy nest slot.
      nearestNestSlot.occupiedBy = egg;
      this.tweens.add({
        targets: egg,
        x: nearestNestSlot.x,
        y: nearestNestSlot.y,
        scale: 0.13,
        duration: 120,
        ease: 'Sine.easeOut',
      });
      egg.setData('origin', { type: 'slot', slot: nearestNestSlot });

      // If it came from the basket, replenish that basket slot.
      // Also remove it from basketEggs so stale references don't cause
      // displacement logic to accidentally target this egg later.
      if (origin?.type === 'basket') {
        const slotIndex = egg.getData('basketSlotIndex');
        this.basketEggs = this.basketEggs.filter((e) => e !== egg);
        this.replenishBasket(slotIndex);
      }
      return;
    }

    // Second check: dropped over the basket? (nest egg returning to basket)
    if (origin?.type === 'slot') {
      const nearestBasketSlot = this.findNearestBasketSlot(egg.x, egg.y);
      if (nearestBasketSlot !== -1) {
        // Try to find an empty slot first; if all are occupied, displace the
        // nearest slot's occupant (it was spawned by replenishment when the
        // original egg left — a temporary placeholder that is no longer needed).
        let targetSlotIndex = this.findEmptyBasketSlot();
        if (targetSlotIndex === -1) {
          targetSlotIndex = nearestBasketSlot;
          const occupant = this.basketEggs.find(
            (e) => e.getData('basketSlotIndex') === targetSlotIndex
          );
          if (occupant && occupant.scene) {
            // Smooth fade-out so the displaced egg doesn't vanish abruptly.
            this.tweens.add({
              targets: occupant,
              alpha: 0,
              scale: 0,
              duration: 150,
              onComplete: () => {
                if (occupant.scene) occupant.destroy();
              },
            });
            this.basketEggs = this.basketEggs.filter((e) => e !== occupant);
            this.interactiveEggs = this.interactiveEggs.filter((e) => e !== occupant);
          }
        }

        // Free the nest slot this egg came from.
        origin.slot.occupiedBy = null;
        origin.slot.locked = false;

        // Tween egg to the basket slot.
        const basketSlot = this.basketSlots[targetSlotIndex];
        this.tweens.add({
          targets: egg,
          x: basketSlot.x,
          y: basketSlot.y,
          scale: 0.13,
          duration: 180,
          ease: 'Back.easeOut',
        });
        egg.setData('origin', { type: 'basket' });
        egg.setData('basketSlotIndex', targetSlotIndex);
        this.basketEggs.push(egg);
        // Egg is already in interactiveEggs from initial spawn — no duplicate push needed.
        return;
      }
    }

    // Fallback: snap back to origin.
    let tx, ty;
    let snapScale;
    if (origin?.type === 'slot') {
      tx = origin.slot.x;
      ty = origin.slot.y;
      snapScale = 0.13;
    } else {
      // Basket egg — snap to its specific basket slot.
      const slotIndex = egg.getData('basketSlotIndex');
      const slot = this.basketSlots[slotIndex];
      tx = slot.x;
      ty = slot.y;
      snapScale = 0.13; // matches the scale basket eggs settle at after pop-in
    }
    this.tweens.add({
      targets: egg,
      x: tx,
      y: ty,
      scale: snapScale,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  // Returns the index of the nearest basket slot within snap radius, or -1.
  findNearestBasketSlot(x, y) {
    const radius = this.scale.width * BASKET_SNAP_RADIUS_FACTOR;
    let nearest = -1;
    let nearestDist = radius;
    for (let i = 0; i < this.basketSlots.length; i++) {
      const slot = this.basketSlots[i];
      const dx = slot.x - x;
      const dy = slot.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }

  findNearestEmptySlot(x, y) {
    // In fill mode, the Blue Nest is locked and cannot receive eggs.
    const allSlots = this.level.mode === 'fill'
      ? [...this.yellowSlots]
      : [...this.blueSlots, ...this.yellowSlots];
    const { width } = this.scale;
    const snapRadius = width * 0.08; // adaptive snap radius

    let nearest = null;
    let nearestDist = snapRadius;

    for (const slot of allSlots) {
      if (slot.occupiedBy) continue;
      const dx = slot.x - x;
      const dy = slot.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = slot;
      }
    }
    return nearest;
  }

  // -----------------------------------------------------------------------
  // Buttons
  // -----------------------------------------------------------------------

  buildButtons() {
    const { width, height } = this.scale;
    // Buttons moved up from the bottom edge and enlarged.
    const btnY = height - 60;

    // Home — redesigned with background color
    this.createPillButton(50, btnY, '\uD83C\uDFE0', {
      fontSize: '26px', paddingX: 18, paddingY: 14, depth: 20, bgColor: 0x3fb6ea, textColor: '#ffffff',
    }).on('pointerup', () => {
      // Stop any in-progress voice before switching scenes.
      if (this.currentVoice) {
        this.currentVoice.stop();
        this.currentVoice.destroy();
        this.currentVoice = null;
      }
      this.scene.start('LevelSelectScene');
    });

    // Check — bigger primary green button
    this.checkBtn = this.createPillButton(width / 2, btnY, 'Check \u2705', {
      fontSize: '26px', paddingX: 32, paddingY: 14, depth: 20, bgColor: 0x51cf66, textColor: '#ffffff',
    });
    this.checkBtn.on('pointerup', () => this.checkAnswer());

    // Reset — redesigned with background color
    this.createPillButton(width - 50, btnY, '\uD83D\uDD04', {
      fontSize: '26px', paddingX: 18, paddingY: 14, depth: 20, bgColor: 0xf06595, textColor: '#ffffff',
    }).on('pointerup', () => this.resetRound());

    // Hint — only on fill levels (level 2 & 4, i.e. mode === 'fill').
    // Positioned lower on the right side, below the nest area.
    if (this.level.mode === 'fill') {
      this.hintBtn = this.createPillButton(width - 12, height * 0.72, '\uD83D\uDCA1 Hint', {
        fontSize: '18px', paddingX: 16, paddingY: 10, depth: 20, anchor: 'topRight',
        bgColor: 0xffd93d, textColor: '#0f3d5c', simple: true,
      });
      this.hintBtn.on('pointerup', () => this.showHint());
    }
  }

  // -----------------------------------------------------------------------
  // Round setup
  // -----------------------------------------------------------------------

  setupRound() {
    this.isCorrectAnimating = false;
    this.checkBtn.container.setVisible(true);
    this.checkBtn.container.setAlpha(1);

    const round = this.rounds[this.roundIndex];
    const target = round.target;
    const isSpelled = round.format === 'spelled';
    const display = isSpelled ? NUMBER_WORDS[target] : `${target}`;
    const { width, height } = this.scale;

    // Destroy old highlight number from a previous round.
    if (this.highlightNum) {
      this.highlightNum.destroy();
      this.highlightNum = null;
    }

    // Destroy old target banner and its background from a previous round.
    if (this.targetBanner) this.targetBanner.destroy();
    if (this.bannerBg) this.bannerBg.destroy();

    // Target number positioned between the two nests and above them.
    // nestTop is the top of the nest area; the banner sits just above it.
    const targetY = this.nestTop - 18;

    // White pill background behind the banner for contrast against the art.
    const bannerFontSize = Math.min(32, width * 0.075);
    const fullText = `This family has ${display} eggs altogether.`;
    const tempMeasure = this.add.text(0, 0, fullText, {
      fontSize: `${bannerFontSize}px`,
      fontFamily: 'Fredoka, sans-serif',
    });
    const bannerW = tempMeasure.width + 40;
    const bannerH = tempMeasure.height + 18;
    tempMeasure.destroy();

    this.bannerBg = this.add.graphics().setDepth(19);
    this.bannerBg.fillStyle(0xffffff, 0.85);
    this.bannerBg.fillRoundedRect(
      width / 2 - bannerW / 2, targetY - bannerH / 2, bannerW, bannerH, 20
    );

    // Main banner text — shows the number as a digit or a word.
    this.targetBanner = this.add.text(width / 2, targetY, fullText, {
      fontSize: `${bannerFontSize}px`,
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
      align: 'center',
    }).setOrigin(0.5).setDepth(21);

    // Bigger, bolder highlighted number (digit or word) with a warm
    // red-orange color and heavy white stroke for punch.
    const highlightFontSize = Math.min(80, width * 0.12);
    this.highlightNum = this.add.text(width / 2, height  / 2 - 100 , display, {
      fontSize: `${highlightFontSize}px`,
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#e63946',
      stroke: '#ffffff',
      strokeThickness: 7,
    }).setOrigin(0.5, 1).setDepth(22);

    // Fill mode: place locked eggs in Blue Nest.
    if (this.level.mode === 'fill' && round.given > 0) {
      this.placeFillEggs(round.given);
    }

    // Round-start voice chain.
    this.playRoundVoiceChain();
  }

  // Places non-interactive locked eggs into the Blue Nest for fill mode.
  placeFillEggs(count) {
    for (let i = 0; i < this.blueSlots.length && i < count; i++) {
      const slot = this.blueSlots[i];
      if (slot.occupiedBy) {
        // Already has an egg from a previous round — skip (handled by cleanup).
        continue;
      }
      const egg = this.add.image(slot.x, slot.y, 'egg').setDepth(4);
      egg.setScale(0.13);
      egg.setTint(pickRandom(EGG_TINTS));
      // Locked — do NOT call makeDraggable or setInteractive.
      slot.occupiedBy = egg;
      slot.locked = true;
      egg.setData('origin', { type: 'slot', slot });
    }
  }

  // -----------------------------------------------------------------------
  // Voice chain (4.3 step 11)
  // -----------------------------------------------------------------------

  playRoundVoiceChain() {
    const level = this.level;
    const round = this.rounds[this.roundIndex];
    const target = round.target;

    // Welcome plays only once per level, on the first round.
    if (this.roundIndex === 0) {
      playVoice(this, 'vo-welcome', () => {
        this.playInstructionChain(target, level);
      });
    } else {
      this.playInstructionChain(target, level);
    }
  }

  playInstructionChain(target, level) {
    playVoice(this, 'vo-this-family-has', () => {
      playNumberVoice(this, target, false, () => {
        playVoice(this, 'vo-eggs-altogether', () => {
          const instructionKey = level.mode === 'split' ? 'vo-split-instruction' : 'vo-fill-instruction';
          playVoice(this, instructionKey);
        });
      });
    });
  }

  // -----------------------------------------------------------------------
  // 4.5 checkAnswer()
  // -----------------------------------------------------------------------

  checkAnswer() {
    if (this.isCorrectAnimating) return;

    const blueCount = this.blueSlots.filter((s) => s.occupiedBy).length;
    const yellowCount = this.yellowSlots.filter((s) => s.occupiedBy).length;
    const round = this.rounds[this.roundIndex];
    const target = round.target;
    const given = round.given;

    let correct;
    if (this.level.mode === 'split') {
      // Both nests must have at least 1 egg each and sum to the target.
      correct = blueCount >= 1 && yellowCount >= 1 && blueCount + yellowCount === target;
    } else {
      // Fill mode: only Yellow Nest count matters (Blue has `given` locked).
      correct = yellowCount === target - given;
    }

    if (correct) {
      this.playCorrectFeedback();
    } else {
      // Check if any nest is empty — use the specific "needs at least 1" voice.
      const anyNestEmpty = this.level.mode === 'split'
        ? blueCount === 0 || yellowCount === 0
        : yellowCount === 0;
      this.playIncorrectFeedback(anyNestEmpty, blueCount, yellowCount, target);
    }
  }

  // -----------------------------------------------------------------------
  // 4.6 playCorrectFeedback()
  // -----------------------------------------------------------------------

  playCorrectFeedback() {
    this.isCorrectAnimating = true;
    this.checkBtn.container.disableInteractive();

    // 1. Swap bird to happy sprite and kill the idle float tween so it doesn't
    //    fight the dance animation.
    this.bird.setTexture(`${this.level.bird}-happy`);
    if (this.birdFloatTween) this.birdFloatTween.stop();

    // 2. White transparent overlay behind the bird during the close-up dance
    //    so the game board is softly obscured. Fades in alongside Phase 1,
    //    fades out with Phase 3.
    const { width, height } = this.scale;
    const dimOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1)
      .setDepth(50).setAlpha(0);

    const origX = this.bird.x;
    const origY = this.bird.y;
    const origScale = this.bird.scaleX;

    // Phase 1: zoom to center with dim overlay fade-in (350ms)
    this.tweens.add({
      targets: this.bird,
      x: width / 2,
      y: height * 0.52,
      scaleX: origScale * 2.4,
      scaleY: origScale * 2.4,
      duration: 350,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2: happy wiggle close-up — slower, smoother bounces
        // (3 bounces × 280ms = 840ms)
        this.tweens.add({
          targets: this.bird,
          scaleX: origScale * 2.5,
          scaleY: origScale * 2.5,
          angle: { from: -8, to: 8 },
          duration: 280,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Phase 3: swoop back to perch with dim overlay fade-out (350ms)
            this.bird.setAngle(0);
            this.tweens.add({
              targets: this.bird,
              x: origX, y: origY,
              scaleX: origScale, scaleY: origScale,
              duration: 350,
              ease: 'Sine.easeIn',
            });
            this.tweens.add({
              targets: dimOverlay,
              alpha: 0,
              duration: 350,
              ease: 'Sine.easeIn',
              onComplete: () => {
                dimOverlay.destroy();
                this.bird.setTexture(this.level.bird);
                // Restart the idle float tween now that the dance is done.
                this.birdFloatTween = this.tweens.add({
                  targets: this.bird,
                  y: origY + 8,
                  duration: 1600,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                });
              },
            });
          },
        });
      },
    });

    // Fade the overlay in during Phase 1.
    this.tweens.add({
      targets: dimOverlay,
      alpha: 0.5,
      duration: 350,
      ease: 'Sine.easeOut',
    });

    // 3. Correct voice at random.
    playVoice(this, pickRandom(CORRECT_VOICES));

    // 4. Emit confetti event for React layer.
    this.game.events.emit('game7-round-correct');

    // 5. Extra celebration time (~930ms after bird returns), then confetti
    //    burst right before advancing.
    this.time.delayedCall(2800, () => {
      this.game.events.emit('game7-round-correct');
      this.nextRound();
    });
  }

  // -----------------------------------------------------------------------
  // 4.7 playIncorrectFeedback()
  // -----------------------------------------------------------------------

  playIncorrectFeedback(anyNestEmpty, blueCount, yellowCount, target) {
    // Shake the bird as a visual cue.
    this.tweens.add({
      targets: this.bird,
      x: this.bird.x + 8,
      duration: 80,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.bird.setX(this.bird.x);
      },
    });

    // Play the empty-nest voice when a nest has no eggs, otherwise a random
    // generic try-again line.
    playVoice(this, anyNestEmpty ? 'vo-try-again-3' : pickRandom(TRY_AGAIN_VOICES));

    // Do NOT reset board — child adjusts and presses Check again.
    this.checkBtn.container.setInteractive({ useHandCursor: true });
  }

  showWrongCount(blueCount, yellowCount, target) {
    const { width } = this.scale;
    const highlightFontSize = Math.min(80, width * 0.12);

    // Find the horizontal center of each nest's slot grid using first/last slot.
    const nestCenterX = (slots) => {
      if (!slots.length) return width * 0.5;
      return (slots[0].x + slots[slots.length - 1].x) / 2;
    };

    // Position well below the lowest slot so the number is clearly under the grid.
    const belowY = (slots) => {
      if (!slots.length) return 0;
      return slots[slots.length - 1].y + 80;
    };

    const spawnPopup = (x, y, count) => {
      const popup = this.add.text(x, y, `${count}`, {
        fontSize: `${highlightFontSize}px`,
        fontFamily: 'Fredoka, sans-serif',
        fontStyle: 'bold',
        color: '#e63946',
        stroke: '#ffffff',
        strokeThickness: 6,
        align: 'center',
      }).setOrigin(0.5).setDepth(45).setScale(0).setAlpha(1);

      this.tweens.add({
        targets: popup,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });

      this.time.delayedCall(2000, () => {
        this.tweens.add({
          targets: popup,
          alpha: 0,
          scale: 0.5,
          duration: 400,
          ease: 'Sine.easeIn',
          onComplete: () => popup.destroy(),
        });
      });
    };

    // Show count below both nests for all modes.
    spawnPopup(nestCenterX(this.blueSlots), belowY(this.blueSlots), blueCount);
    spawnPopup(nestCenterX(this.yellowSlots), belowY(this.yellowSlots), yellowCount);
  }

  // -----------------------------------------------------------------------
  // 4.8 nextRound() / level completion
  // -----------------------------------------------------------------------

  nextRound() {
    this.roundIndex += 1;

    if (this.roundIndex < this.rounds.length) {
      // --- Next round within same level ---

      // Reset bird texture.
      this.bird.setTexture(this.level.bird);

      // Destroy all interactive (non-locked) eggs in nests.
      this.destroyInteractiveEggs();

      // Update round pill.
      this.roundPill.setText(`Round ${this.roundIndex + 1}/${this.rounds.length}`);
      this.tweens.add({ targets: this.roundPill.container, scale: 1.15, duration: 150, yoyo: true });

      // Destroy and recreate target banner number highlight.
      if (this.highlightNum) this.highlightNum.destroy();

      // Setup the new round — this calls setupRound which handles fill eggs etc.
      this.isCorrectAnimating = false;
      this.checkBtn.container.setVisible(true);
      this.checkBtn.container.setInteractive({ useHandCursor: true });

      // Clear all non-locked slot occupancy.
      [...this.blueSlots, ...this.yellowSlots].forEach((slot) => {
        if (!slot.locked) {
          slot.occupiedBy = null;
        }
      });

      // Destroy previous round's locked fill eggs so placeFillEggs can rebuild
      // with the new round's given count (which may be larger or smaller).
      this.blueSlots.forEach((slot) => {
        if (slot.locked && slot.occupiedBy) {
          const egg = slot.occupiedBy;
          if (egg && egg.scene) egg.destroy();
          slot.occupiedBy = null;
          slot.locked = false;
        }
      });

      // Restock basket — destroy and respawn.
      this.basketEggs.forEach((e) => {
        if (e && e.scene) e.destroy();
      });
      this.basketEggs = [];
      this.interactiveEggs = [];
      for (let i = 0; i < BASKET_EGG_COUNT; i++) {
        this.spawnBasketEgg(i, true);
      }

      // Setup the round (includes fill eggs + voice chain).
      this.setupRound();
    } else {
      // --- Level complete ---
      this.completeLevel();
    }
  }

  destroyInteractiveEggs() {
    [...this.blueSlots, ...this.yellowSlots].forEach((slot) => {
      if (slot.occupiedBy && !slot.locked) {
        const egg = slot.occupiedBy;
        if (egg && egg.scene) egg.destroy();
        slot.occupiedBy = null;
      }
    });
  }

  completeLevel() {
    // Mark level complete in progress.
    progress.completeLevel(this.levelIndex);

    const isLastLevel = this.levelIndex === LEVELS.length - 1;

    // Voice: level-complete or game-complete.
    if (isLastLevel) {
      playVoice(this, 'vo-game-complete');
    } else {
      playVoice(this, 'vo-level-complete');
    }

    // Emit level-complete event for confetti overlay.
    this.game.events.emit('game7-level-complete', { levelIndex: this.levelIndex });

    // Compute elapsed time & mistakes (no mistake tracking in this game, so 0).
    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);

    // Emit game7-complete for logPlaySession on every level completion,
    // not just the last one. Matches Game4's pattern: stars/totalRounds
    // scale with the level index so each level logs its own progress.
    this.game.events.emit('game7-complete', {
      elapsedSeconds,
      mistakes: 0,
      level: this.levelIndex + 1,
      levelKey: this.level.key,
      stars: this.levelIndex + 1,
      totalRounds: this.levelIndex + 1,
    });

    // Show end overlay.
    this.showEndOverlay(isLastLevel);
  }

  showEndOverlay(isLastLevel) {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55).setDepth(40);

    const panelW = Math.min(400, width - 60);
    const panelH = 240;

    const panelGroup = this.add.container(width / 2, height / 2).setDepth(41).setScale(0);
    this.tweens.add({ targets: panelGroup, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);

    const title = this.add.text(0, -50, isLastLevel ? 'All Done!' : 'Level Complete!', {
      fontSize: '32px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, 0, isLastLevel
      ? "You're a number bond superstar!"
      : 'Amazing! You finished the level!', {
      fontSize: '22px',
      fontFamily: 'Fredoka, sans-serif',
      color: '#4a6478',
      align: 'center',
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);

    panelGroup.add([panel, title, subtitle]);

    const btnY = height / 2 + 80;

    if (isLastLevel) {
      this.createPillButton(width / 2, btnY, 'Level Select \uD83C\uDFE0', {
        fontSize: '22px', paddingX: 26, paddingY: 14, depth: 42,
      }).on('pointerup', () => {
        this.scene.start('LevelSelectScene');
      });
    } else {
      // "Next Level" button.
      this.createPillButton(width / 2 - 80, btnY, 'Next Level \u27A1\uFE0F', {
        fontSize: '20px', paddingX: 20, paddingY: 12, depth: 42,
      }).on('pointerup', () => {
        this.scene.start('GameScene', { levelIndex: this.levelIndex + 1 });
      });

      this.createPillButton(width / 2 + 80, btnY, 'Levels \uD83C\uDFE0', {
        fontSize: '20px', paddingX: 20, paddingY: 12, depth: 42,
      }).on('pointerup', () => {
        this.scene.start('LevelSelectScene');
      });
    }
  }

  // -----------------------------------------------------------------------
  // 4.9 resetRound()
  // -----------------------------------------------------------------------

  resetRound() {
    if (this.isCorrectAnimating) return;

    // Only remove eggs that are in nest slots — basket eggs stay put.
    const nestEggs = this.interactiveEggs.filter((egg) => {
      if (!egg || !egg.scene) return false;
      return egg.getData('origin')?.type === 'slot';
    });

    // Tween each nest egg back to the basket then destroy.
    nestEggs.forEach((egg) => {
      const origin = egg.getData('origin');
      if (origin?.slot) {
        origin.slot.occupiedBy = null;
      }
      this.tweens.add({
        targets: egg,
        x: this.basketPos.x + (Math.random() - 0.5) * 60,
        y: this.basketPos.y + (Math.random() - 0.5) * 10,
        scale: 0.13,
        alpha: 0,
        duration: 250,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (egg.scene) egg.destroy();
        },
      });
    });

    // Remove destroyed nest eggs from tracking arrays, keep basket eggs.
    this.interactiveEggs = this.interactiveEggs.filter((egg) => {
      if (!egg || !egg.scene) return false;
      return egg.getData('origin')?.type === 'basket';
    });
    this.basketEggs = this.basketEggs.filter((e) => e && e.scene);

    // Safety net: clear any non-locked slot occupancy on orphaned slots.
    [...this.blueSlots, ...this.yellowSlots].forEach((slot) => {
      if (!slot.locked) slot.occupiedBy = null;
    });

    // Restock any missing basket slots.
    const occupiedSlots = new Set(this.basketEggs.map((e) => e.getData('basketSlotIndex')));
    for (let i = 0; i < BASKET_EGG_COUNT; i++) {
      if (!occupiedSlots.has(i)) {
        this.spawnBasketEgg(i, true);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4.10 showHint()
  // -----------------------------------------------------------------------

  showHint() {
    // Prevent double-taps during correct feedback.
    if (this.isCorrectAnimating) return;

    playVoice(this, 'vo-hint');

    // Show the current nest counts below each nest.
    const hBlue = this.blueSlots.filter((s) => s.occupiedBy).length;
    const hYellow = this.yellowSlots.filter((s) => s.occupiedBy).length;
    const hRound = this.rounds[this.roundIndex];
    this.showWrongCount(hBlue, hYellow, hRound.target);

    // Soft radial glow behind each locked Blue Nest egg — concentric filled
    // circles with decreasing alpha simulate a blurry glow effect. Fades in,
    // holds, then fades out.
    const lockedSlots = this.blueSlots.filter((s) => s.locked && s.occupiedBy);
    lockedSlots.forEach((slot) => {
      const glow = this.add.graphics().setDepth(5).setAlpha(0);
      // Multiple layers of decreasing opacity for a soft glow look.
      const layers = [
        { r: 30, a: 0.08 },
        { r: 24, a: 0.12 },
        { r: 18, a: 0.2 },
        { r: 13, a: 0.35 },
      ];
      layers.forEach(({ r, a }) => {
        glow.fillStyle(0xffd93d, a);
        glow.fillCircle(slot.x, slot.y, r);
      });
      // Fade in
      this.tweens.add({ targets: glow, alpha: 0.85, duration: 350, ease: 'Sine.easeOut' });
      // Hold, then fade out and destroy
      this.time.delayedCall(2200, () => {
        this.tweens.add({
          targets: glow,
          alpha: 0,
          duration: 500,
          ease: 'Sine.easeIn',
          onComplete: () => glow.destroy(),
        });
      });
    });
  }
}

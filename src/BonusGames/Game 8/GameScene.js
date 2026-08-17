// GameScene.js
// Game 8 — "Pizza Order!" (Number Bonds via Pizza Toppings).
//
// One continuous 10-round run in a single scene. Rounds 1-5 ask "find the
// total"; rounds 6-10 silently switch to "find the missing part" (no scene
// transition — just an internal mode flip after round 5). Each round has two
// phases: 'topping' (drag toppings onto the pizza to match an order total)
// then 'numberBond' (answer a number-bond question about the same numbers).

import * as Phaser from 'phaser';
import BaseScene from '../../Phaser/BaseScene';
import { buildRoundSequence, TOTAL_ROUNDS, MODES } from './levels';
import { ensureBgMusic, addMuteButton } from './audioState';
import { playNumberVoice } from '../../Phaser/common/numbersVoice';

// Layout constants (720x1080 base resolution — see Phaser/config.js).
// Sized for small hands: a big pizza, big tappable containers, big chefs.
const PIZZA_CENTER = { x: 360, y: 520 };
const PIZZA_DIAMETER = 460;
const SLOT_COLS = 5;
const SLOT_ROWS = 4;
const SLOT_GAP = 76;
const SLOT_RADIUS = 31; // matches the topping footprint so drops look natural
const TOPPING_SIZE = 60;
const CONTAINER_SIZE = 130;
const CONTAINER_Y = 210;
const CONTAINER_SPACING = 136;
const SNAP_RADIUS = 66;
const CHEF_HEIGHT = 400;
const DELIVER_WIDTH = 260;
const DELIVER_Y = 890;
const DANCE_SCALE_FACTOR = 1.5;

const CONTAINER_DEFS = [
  { containerKey: 'container-pepperoni', toppingKey: 'pepperoni' },
  { containerKey: 'container-tomatoes', toppingKey: 'tomato' },
  { containerKey: 'container-olives', toppingKey: 'olives' },
  { containerKey: 'container-mushrooms', toppingKey: 'mushrooms' },
  { containerKey: 'container-bellPepper', toppingKey: 'bellPepper' },
];

// Safe voice playback — skips gracefully if a clip failed to load, and stops
// any previous voice so lines never overlap.
function playVoice(scene, key, onComplete) {
  if (!scene.cache.audio.exists(key)) {
    console.warn(`playVoice(): "${key}" not loaded, skipping.`);
    if (onComplete) onComplete();
    return null;
  }
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

// Measures a texture's native pixel size without leaving it on screen.
function measureTexture(scene, key) {
  const probe = scene.add.image(-1000, -1000, key);
  const w = probe.width;
  const h = probe.height;
  probe.destroy();
  return { w, h };
}

// Renders "Order: N" with the number much larger and in a warm highlight
// color, since Phaser Text can't mix sizes/colors in one line. Baked into a
// canvas texture and refreshed for each level-2 round.
function makeOrderTexture(scene, total, key) {
  const parts = [
    { text: 'Order: ', size: 48, color: '#ffffff', stroke: '#0f3d5c' },
    { text: `${total}`, size: 92, color: '#e63946', stroke: '#ffffff' },
  ];
  const fontFor = (p) => `900 ${p.size}px Fredoka, sans-serif`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let totalWidth = 0;
  let maxAscent = 0;
  let maxDescent = 0;
  parts.forEach((p) => {
    ctx.font = fontFor(p);
    const m = ctx.measureText(p.text);
    totalWidth += m.width;
    maxAscent = Math.max(maxAscent, m.actualBoundingBoxAscent || p.size * 0.8);
    maxDescent = Math.max(maxDescent, m.actualBoundingBoxDescent || p.size * 0.25);
  });
  totalWidth += 12; // gap between the two parts

  const pad = 14;
  canvas.width = Math.ceil(totalWidth) + pad * 2;
  canvas.height = Math.ceil(maxAscent + maxDescent) + pad * 2;
  const baselineY = pad + maxAscent;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';

  let x = pad;
  parts.forEach((p) => {
    ctx.font = fontFor(p);
    ctx.lineWidth = 8;
    ctx.strokeStyle = p.stroke;
    ctx.strokeText(p.text, x, baselineY);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, x, baselineY);
    x += ctx.measureText(p.text).width + 12;
  });

  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export default class GameScene extends BaseScene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;

    this.startTime = this.time.now;
    this.mistakes = 0;
    this.rounds = buildRoundSequence();
    this.roundIndex = 0;
    this.phase = 'topping';
    this.bondAnswered = false;
    this.currentVoice = null;
    this.slots = [];
    this.containers = [];
    this.bondObjects = []; // container(s) holding the current number-bond UI
    this.optionPills = []; // [{ pill, x, value }]
    this.orderImage = null; // mixed-size "Order: N" banner (level 2)

    // Background music + first-tap unlock, same pattern as the other games.
    ensureBgMusic(this);
    this.input.once('pointerdown', () => ensureBgMusic(this));
    addMuteButton(this, 16, 16, { anchor: 'topLeft' });

    // A tap (no movement) shouldn't spawn a topping — only real drags.
    this.input.dragDistanceThreshold = 8;

    // Stop any in-flight voice when leaving/restarting this scene.
    this.events.once('shutdown', () => {
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

    // 1. Background (cover-fit).
    const bg = this.add.image(width / 2, height / 2, 'gameBackground').setDepth(0);
    const cover = Math.max(width / bg.width, height / bg.height);
    bg.setScale(cover);

    // 2. Chefs — Eka bottom-left, Zee bottom-right. Zee's source art faces
    //    the same way as Eka's, so flip it to face inward toward the pizza.
    this.chefEka = this.buildChef('chefEka', 100, height - 5);
    this.chefZee = this.buildChef('chefZee', width - 100, height - 5, true);

    // 3. Pizza board — pizza, slot outlines and placed toppings live in one
    //    container so the whole board can be dimmed together in Phase B.
    this.board = this.add.container(0, 0).setDepth(5);
    const pizzaTex = measureTexture(this, 'emptyPizza');
    this.pizzaScale = PIZZA_DIAMETER / pizzaTex.w;
    this.pizza = this.add.image(PIZZA_CENTER.x, PIZZA_CENTER.y, 'emptyPizza')
      .setScale(this.pizzaScale);
    this.board.add(this.pizza);
    this.buildSlots();

    // 4. Containers (drag sources — never consumed).
    this.buildContainers();

    // 5. Header UI — big centered text, kept clear of the corner buttons.
    this.bannerText = this.add.text(width / 2, 80, '', {
      fontSize: '48px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0f3d5c',
      strokeThickness: 8,
      align: 'center',
      wordWrap: { width: 460 },
    }).setOrigin(0.5).setDepth(20);

    this.roundPill = this.createPillButton(width - 16, 16, '', {
      fontSize: '22px',
      paddingX: 16,
      paddingY: 10,
      anchor: 'topRight',
      interactive: false,
      depth: 25,
    });

    // 6. Chef speech bubbles (updated every round).
    this.ekaBubble = this.createPillButton(140, 630, '', {
      fontSize: '44px',
      paddingX: 24,
      paddingY: 12,
      interactive: false,
      depth: 20,
    });
    this.zeeBubble = this.createPillButton(width - 140, 630, '', {
      fontSize: '44px',
      paddingX: 24,
      paddingY: 12,
      interactive: false,
      depth: 20,
    });

    // 7. Deliver button (asset image, not a text pill) — sits between the
    //    two chefs at the bottom.
    this.deliverBtn = this.buildDeliverButton();

    // 8. Shared "Try again!" toast for wrong order checks.
    this.tryAgainToast = this.add.text(width / 2, PIZZA_CENTER.y, 'Try again!', {
      fontSize: '48px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#e63946',
      stroke: '#ffffff',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(35).setVisible(false);

    this.setupRound(0);
  }

  buildChef(key, x, y, flip = false) {
    const tex = measureTexture(this, key);
    const scale = CHEF_HEIGHT / tex.h;
    const chef = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(60);
    if (flip) chef.setFlipX(true);
    chef.baseScale = scale;
    chef.normalKey = key;
    chef.celebratingKey = key === 'chefEka' ? 'chefEkaCelebrating' : 'chefZeeCelebrating';
    return chef;
  }

  buildSlots() {
    this.slots = [];
    for (let r = 0; r < SLOT_ROWS; r += 1) {
      for (let c = 0; c < SLOT_COLS; c += 1) {
        // Skip the 4 grid corners so the spot arrangement stays round and
        // mirrors the pizza's circular crust.
        const isCorner =
          (r === 0 || r === SLOT_ROWS - 1) && (c === 0 || c === SLOT_COLS - 1);
        if (isCorner) continue;

        const x = PIZZA_CENTER.x + (c - (SLOT_COLS - 1) / 2) * SLOT_GAP;
        const y = PIZZA_CENTER.y + (r - (SLOT_ROWS - 1) / 2) * SLOT_GAP;
        this.slots.push({ x, y, topping: null, locked: false, lockedGlow: null });

        // A soft round "dimple" reads as a natural resting spot for a round
        // topping, with the faint outline kept subtle.
        const spot = this.add.graphics();
        spot.fillStyle(0x000000, 0.08);
        spot.fillCircle(x, y, SLOT_RADIUS);
        spot.lineStyle(2, 0xffffff, 0.5);
        spot.strokeCircle(x, y, SLOT_RADIUS);
        this.board.add(spot);
      }
    }
  }

  buildContainers() {
    const toppingTex = measureTexture(this, 'pepperoni');
    this.toppingScale = TOPPING_SIZE / toppingTex.w;

    CONTAINER_DEFS.forEach((def, i) => {
      const x = PIZZA_CENTER.x + (i - 2) * CONTAINER_SPACING;
      const tex = measureTexture(this, def.containerKey);
      const scale = CONTAINER_SIZE / tex.w;
      const container = this.add.image(x, CONTAINER_Y, def.containerKey)
        .setScale(scale)
        .setDepth(15)
        .setData('toppingKey', def.toppingKey);
      this.makeContainerDraggable(container);
      this.containers.push(container);
    });
  }

  buildDeliverButton() {
    const tex = measureTexture(this, 'deliver-button');
    this.deliverScale = DELIVER_WIDTH / tex.w;
    const btn = this.add.image(PIZZA_CENTER.x, DELIVER_Y, 'deliver-button')
      .setScale(this.deliverScale)
      .setDepth(25);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      this.tweens.killTweensOf(btn);
      btn.setScale(this.deliverScale * 0.94);
    });
    btn.on('pointerup', () => {
      btn.setScale(this.deliverScale);
      this.onDeliver();
    });
    btn.on('pointerout', () => btn.setScale(this.deliverScale));

    return btn;
  }

  // "Copy on drag start" — the container itself never moves. Pressing and
  // dragging it spawns a fresh topping under the pointer, which follows the
  // drag and is handled on release.
  makeContainerDraggable(container) {
    container.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(container);

    let draggedTopping = null;

    container.on('drag', (_pointer, dragX, dragY) => {
      if (this.phase !== 'topping') return;

      // Spawn on the first real movement ("copy on drag start") — the
      // container itself never moves; a fresh topping follows the pointer.
      if (!draggedTopping) {
        const toppingKey = container.getData('toppingKey');
        draggedTopping = this.add.image(dragX, dragY, toppingKey)
          .setDepth(30)
          .setScale(this.toppingScale)
          .setData('sourceContainer', container);
        this.playSound('grab-fx');
      }

      draggedTopping.x = dragX;
      draggedTopping.y = dragY;
    });

    container.on('dragend', (pointer) => {
      if (!draggedTopping) return;
      const topping = draggedTopping;
      draggedTopping = null;
      this.onToppingDragEnd(topping, pointer);
    });
  }

  onToppingDragEnd(topping, pointer) {
    if (this.phase !== 'topping') {
      topping.destroy();
      return;
    }

    const slot = this.findNearestOpenSlot(pointer.x, pointer.y);
    if (slot) {
      this.playSound('paste-fx');
      slot.topping = topping;
      this.board.add(topping);
      this.tweens.add({
        targets: topping,
        x: slot.x,
        y: slot.y,
        scale: this.toppingScale,
        duration: 120,
        ease: 'Sine.easeOut',
      });
      // Tap a placed topping to pop it back off the pizza.
      topping.setInteractive({ useHandCursor: true });
      topping.setData('slot', slot);
      topping.on('pointerdown', () => this.popTopping(topping));
    } else {
      // No open spot nearby — tween back to its container and discard.
      const source = topping.getData('sourceContainer');
      const tx = source ? source.x : PIZZA_CENTER.x;
      const ty = source ? source.y : CONTAINER_Y;
      this.tweens.add({
        targets: topping,
        x: tx,
        y: ty,
        alpha: 0,
        scale: this.toppingScale * 0.5,
        duration: 180,
        ease: 'Sine.easeIn',
        onComplete: () => topping.destroy(),
      });
    }
  }

  findNearestOpenSlot(x, y) {
    let nearest = null;
    let nearestDist = SNAP_RADIUS;
    for (const slot of this.slots) {
      if (slot.topping || slot.locked) continue;
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

  popTopping(topping) {
    if (this.phase !== 'topping') return;
    const slot = topping.getData('slot');
    if (!slot || slot.locked) return;
    slot.topping = null;

    const source = topping.getData('sourceContainer');
    const tx = source ? source.x : PIZZA_CENTER.x;
    const ty = source ? source.y : CONTAINER_Y;
    topping.disableInteractive();
    this.tweens.add({
      targets: topping,
      x: tx,
      y: ty,
      alpha: 0,
      scale: this.toppingScale * 0.5,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => topping.destroy(),
    });
  }

  filledCount() {
    return this.slots.filter((s) => s.topping).length;
  }

  playSound(key) {
    if (key && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 1.2 });
    }
  }

  setContainersInteractive(enabled) {
    this.containers.forEach((container) => {
      if (container.input) container.input.enabled = enabled;
    });
  }

  // -------------------------------------------------------------------------
  // Round / phase state machine
  // -------------------------------------------------------------------------

  setupRound(roundIndex) {
    this.roundIndex = roundIndex;
    this.round = this.rounds[roundIndex];
    this.phase = 'topping';
    this.bondAnswered = false;

    // Clear the previous round's toppings (pre-fills and placements alike).
    this.slots.forEach((slot) => {
      if (slot.topping) {
        slot.topping.destroy();
        slot.topping = null;
      }
      if (slot.lockedGlow) {
        slot.lockedGlow.destroy();
        slot.lockedGlow = null;
      }
      slot.locked = false;
    });
    this.destroyBondUI();
    this.board.setAlpha(1);

    this.setChefsTexture(false);
    this.roundPill.setText(`Round ${roundIndex + 1}/${TOTAL_ROUNDS}`);
    this.tryAgainToast.setVisible(false);

    this.ekaBubble.container.setVisible(true);
    this.zeeBubble.container.setVisible(true);

    this.deliverBtn.setVisible(true);
    this.deliverBtn.setScale(this.deliverScale);
    this.deliverBtn.setInteractive({ useHandCursor: true });
    this.setContainersInteractive(true);

    // Chef bubbles mirror the spoken numbers. Rounds 6-10 keep Zee's need a
    // mystery (the child has to solve for it in Phase B), while the big top
    // text shows the order total they're aiming for.
    if (this.round.mode === MODES.FIRST_HALF) {
      this.bannerText.setText('Drag toppings onto the pizza!');
      this.bannerText.setVisible(true);
      if (this.orderImage) this.orderImage.setVisible(false);
      this.ekaBubble.setText(`${this.round.ekaWants}`);
      this.zeeBubble.setText(`${this.round.zeeWants}`);
    } else {
      // Level 2: show "Order: N" with the number bigger and highlighted.
      const key = makeOrderTexture(this, this.round.total, 'game8-order');
      if (!this.orderImage) {
        this.orderImage = this.add.image(this.scale.width / 2, 78, key).setDepth(20);
      } else {
        this.orderImage.setTexture(key);
        this.orderImage.setVisible(true);
      }
      this.bannerText.setVisible(false);
      this.ekaBubble.setText(`${this.round.ekaHas}`);
      this.zeeBubble.setText('?');
    }

    // Rounds 6-10 start pre-filled with Eka's locked toppings.
    if (this.round.mode === MODES.SECOND_HALF) {
      this.prefillToppings(this.round.ekaHas);
    }

    this.playPhaseAVoice();
  }

  prefillToppings(count) {
    const toppingKeys = CONTAINER_DEFS.map((d) => d.toppingKey);
    for (let i = 0; i < this.slots.length && i < count; i += 1) {
      const slot = this.slots[i];

      // Gold glow + ring marks Eka's locked toppings so it's clear these
      // can't be moved or removed.
      const glow = this.add.graphics();
      glow.fillStyle(0xffd93d, 0.22);
      glow.fillCircle(slot.x, slot.y, SLOT_RADIUS + 4);
      glow.lineStyle(5, 0xffd93d, 0.95);
      glow.strokeCircle(slot.x, slot.y, SLOT_RADIUS + 4);
      slot.lockedGlow = glow;
      this.board.add(glow);

      const topping = this.add.image(slot.x, slot.y, toppingKeys[i % toppingKeys.length])
        .setScale(this.toppingScale)
        .setAlpha(0);
      slot.topping = topping;
      slot.locked = true; // locked pre-fills are not draggable or tappable
      this.board.add(topping);
      // Staggered fade-in reads better than a jump-cut.
      this.tweens.add({ targets: topping, alpha: 1, delay: i * 90, duration: 200 });
    }
  }

  playPhaseAVoice() {
    const round = this.round;
    if (this.roundIndex === 0) {
      // vo-1 plays exactly once, on the very first round of the whole game.
      playVoice(this, 'vo-1', () => this.playFirstHalfChain(round));
    } else if (round.mode === MODES.FIRST_HALF) {
      this.playFirstHalfChain(round);
    } else {
      this.playSecondHalfChain(round);
    }
  }

  playFirstHalfChain(round) {
    playVoice(this, 'vo-2', () => {
      playNumberVoice(this, round.ekaWants, false, () => {
        playVoice(this, 'vo-3', () => {
          playNumberVoice(this, round.zeeWants);
        });
      });
    });
  }

  playSecondHalfChain(round) {
    // "Chef Eka has put [n]. The order needs [total]. Help chef Zee put the
    // remaining toppings."
    playVoice(this, 'vo-4', () => {
      playNumberVoice(this, round.ekaHas, false, () => {
        playVoice(this, 'vo-5', () => {
          playNumberVoice(this, round.total, false, () => {
            playVoice(this, 'vo-6');
          });
        });
      });
    });
  }

  onDeliver() {
    if (this.phase !== 'topping') return;

    if (this.filledCount() === this.round.total) {
      // Phase A success — local celebration only, then on to the number bond.
      this.phase = 'transition';
      this.setContainersInteractive(false);
      this.deliverBtn.disableInteractive();
      this.game.events.emit('game8-deliver-correct');
      this.celebrateChefs(false);
      this.time.delayedCall(900, () => this.enterNumberBond());
    } else {
      this.mistakes += 1;
      playVoice(this, 'vo-try-again');
      // Shake the pizza, leave the toppings as-is so the child can adjust.
      this.tweens.add({
        targets: this.board,
        x: 8,
        duration: 60,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => this.board.setX(0),
      });
      this.showTryAgain();
    }
  }

  showTryAgain() {
    this.tryAgainToast.setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.tryAgainToast);
    this.tweens.add({
      targets: this.tryAgainToast,
      alpha: 0,
      delay: 1200,
      duration: 300,
      onComplete: () => this.tryAgainToast.setVisible(false),
    });
  }

  enterNumberBond() {
    this.phase = 'numberBond';
    this.setContainersInteractive(false);
    this.deliverBtn.setVisible(false);
    this.deliverBtn.disableInteractive();
    this.ekaBubble.container.setVisible(false);
    this.zeeBubble.container.setVisible(false);
    this.bannerText.setText('Answer the number bond!');
    this.bannerText.setVisible(true);
    if (this.orderImage) this.orderImage.setVisible(false);
    this.tryAgainToast.setVisible(false);
    // Dim the pizza so the bond reads clearly over it.
    this.board.setAlpha(0.45);

    playVoice(this, 'vo-7'); // "What is the missing number?"
    this.buildNumberBond();
  }

  buildNumberBond() {
    const round = this.round;

    let leftValue;
    let rightValue;
    let topValue;
    if (round.mode === MODES.FIRST_HALF) {
      // Total is the unknown; both parts are known.
      leftValue = round.ekaWants;
      rightValue = round.zeeWants;
      topValue = '?';
      this.bondAnswer = round.total;
    } else {
      // The missing part is the unknown; the other part and total are known.
      leftValue = round.ekaHas;
      rightValue = '?';
      topValue = round.total;
      this.bondAnswer = round.zeeNeeds;
    }

    const bond = this.add.container(0, 0).setDepth(40);
    this.bondObjects = [bond];

    // Soft white panel so the bond is readable over the pizza art.
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.95);
    panel.fillRoundedRect(PIZZA_CENTER.x - 230, 270, 460, 310, 28);
    bond.add(panel);

    const top = { x: 360, y: 360 };
    const left = { x: 245, y: 500 };
    const right = { x: 475, y: 500 };

    const line = this.add.graphics();
    line.lineStyle(10, 0xf06595, 1);
    line.lineBetween(top.x, top.y, left.x, left.y);
    line.lineBetween(top.x, top.y, right.x, right.y);
    bond.add(line);

    const leftText = this.drawBondCircle(bond, left, leftValue, 0x3fb6ea);
    const rightText = this.drawBondCircle(bond, right, rightValue, 0x51cf66);
    const topText = this.drawBondCircle(bond, top, topValue, 0xffb347);

    // Remember which circle holds the '?' so it can be filled in on a win.
    this.bondQuestionText = leftValue === '?' ? leftText : rightValue === '?' ? rightText : topText;

    // Option pills.
    this.optionPills = [];
    const xs = [245, 360, 475];
    round.options.forEach((value, i) => {
      const pill = this.createPillButton(xs[i], 680, `${value}`, {
        fontSize: '42px',
        minWidth: 112,
        minHeight: 84,
        paddingX: 24,
        paddingY: 14,
        depth: 41,
        bgColor: 0xffffff,
      });
      this.optionPills.push({ pill, x: xs[i], value });
      const wrapper = this.optionPills[this.optionPills.length - 1];
      pill.on('pointerup', () => this.onBondOptionPicked(wrapper));
    });
  }

  drawBondCircle(bond, pos, value, color) {
    const circle = this.add.graphics();
    circle.fillStyle(0xffffff, 1);
    circle.fillCircle(pos.x, pos.y, 70);
    circle.lineStyle(7, color, 1);
    circle.strokeCircle(pos.x, pos.y, 70);
    bond.add(circle);

    const text = this.add.text(pos.x, pos.y, `${value}`, {
      fontSize: '68px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    bond.add(text);
    return text;
  }

  onBondOptionPicked(wrapper) {
    if (this.phase !== 'numberBond' || this.bondAnswered) return;

    const { pill, x, value } = wrapper;

    if (value === this.bondAnswer) {
      this.bondAnswered = true;
      pill.setBg(0x51cf66);
      if (this.bondQuestionText) {
        this.bondQuestionText.setText(`${this.bondAnswer}`);
      }

      this.game.events.emit('game8-round-correct');
      playVoice(this, 'vo-correct');

      const isLast = this.roundIndex === TOTAL_ROUNDS - 1;
      this.playRoundCompleteCelebration(() => {
        if (this.phase !== 'numberBond') return;
        if (isLast) this.finishGame();
        else this.setupRound(this.roundIndex + 1);
      });
    } else {
      this.mistakes += 1;
      playVoice(this, 'vo-try-again');
      this.flashWrongPill(pill, x);
    }
  }

  flashWrongPill(pill, baseX) {
    this.tweens.killTweensOf(pill.container);
    pill.container.setX(baseX);
    pill.setBg(0xff6b6b);
    this.tweens.add({
      targets: pill.container,
      x: baseX + 8,
      duration: 60,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        pill.container.setX(baseX);
        pill.setBg(0xffffff);
      },
    });
  }

  destroyBondUI() {
    this.bondObjects.forEach((obj) => {
      if (obj && obj.destroy) obj.destroy();
    });
    this.bondObjects = [];
    this.optionPills.forEach(({ pill }) => {
      if (pill && pill.destroy) pill.destroy();
    });
    this.optionPills = [];
    this.bondQuestionText = null;
  }

  // -------------------------------------------------------------------------
  // Chefs + end-of-game
  // -------------------------------------------------------------------------

  setChefsTexture(celebrating) {
    this.chefEka.setTexture(celebrating ? this.chefEka.celebratingKey : this.chefEka.normalKey);
    this.chefZee.setTexture(celebrating ? this.chefZee.celebratingKey : this.chefZee.normalKey);
  }

  celebrateChefs(persist = false) {
    this.setChefsTexture(true);
    [this.chefEka, this.chefZee].forEach((chef) => {
      this.tweens.killTweensOf(chef);
      chef.setScale(chef.baseScale);
      this.tweens.add({
        targets: chef,
        scale: chef.baseScale * 1.1,
        duration: 160,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    });

    if (!persist) {
      this.time.delayedCall(900, () => {
        if (this.phase !== 'finished') this.setChefsTexture(false);
      });
    }
  }

  // Big end-of-round celebration: confetti fires via the React layer's
  // game8-round-correct listener, while here both chefs center, enlarge and
  // dance on top of a dim overlay for a few seconds before the next round.
  playRoundCompleteCelebration(onDone) {
    const { width, height } = this.scale;
    const chefs = [this.chefEka, this.chefZee];

    const orig = chefs.map((chef) => ({
      chef,
      x: chef.x,
      y: chef.y,
      scale: chef.baseScale,
      depth: chef.depth,
    }));

    // Dim everything behind the chefs so the board/UI fades back.
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1)
      .setDepth(75)
      .setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 0.6, duration: 300, ease: 'Sine.easeOut' });

    const danceY = height * 0.64;
    const danceXs = [width / 2 - 170, width / 2 + 170];

    chefs.forEach((chef, i) => {
      const danceScale = orig[i].scale * DANCE_SCALE_FACTOR;

      // Chefs layered on top of everything while dancing.
      chef.setDepth(80);
      chef.setTexture(chef.celebratingKey);
      this.tweens.killTweensOf(chef);

      this.tweens.add({
        targets: chef,
        x: danceXs[i],
        y: danceY,
        scale: danceScale,
        duration: 350,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: chef,
            scale: danceScale * 1.06,
            angle: { from: -7, to: 7 },
            duration: 200,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut',
          });
        },
      });
    });

    // Confetti bursts while the chefs are dancing (the wiggle starts right
    // after the 350ms zoom-in).
    this.time.delayedCall(350, () => this.game.events.emit('game8-dance'));

    // Return to original spots, then continue to the next round.
    this.time.delayedCall(2100, () => {
      chefs.forEach((chef, i) => {
        this.tweens.killTweensOf(chef);
        chef.setAngle(0);
        chef.setTexture(chef.normalKey);
        this.tweens.add({
          targets: chef,
          x: orig[i].x,
          y: orig[i].y,
          scale: orig[i].scale,
          duration: 350,
          ease: 'Sine.easeIn',
          // Drop below the overlay only after the return finishes, so the
          // chefs never flash behind anything mid-transition.
          onComplete: () => chef.setDepth(orig[i].depth),
        });
      });
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 350,
        onComplete: () => overlay.destroy(),
      });
    });

    this.time.delayedCall(2450, onDone);
  }

  finishGame() {
    this.phase = 'finished';
    this.destroyBondUI();
    this.setChefsTexture(true);
    this.setContainersInteractive(false);
    this.deliverBtn.setVisible(false);
    this.ekaBubble.container.setVisible(false);
    this.zeeBubble.container.setVisible(false);
    this.board.setAlpha(1);
    this.bannerText.setText('Great job, pizza chef!');
    this.bannerText.setVisible(true);
    if (this.orderImage) this.orderImage.setVisible(false);

    const elapsedSeconds = Math.round((this.time.now - this.startTime) / 1000);
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 3 ? 2 : 1;

    // The single end-of-run log — matches Game.jsx's completeEventName.
    this.game.events.emit('game8-complete', {
      elapsedSeconds,
      mistakes: this.mistakes,
      totalRounds: TOTAL_ROUNDS,
      stars,
    });

    this.showEndOverlay(stars);
  }

  showEndOverlay(stars) {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f3d5c, 0.55).setDepth(90);

    const panel = this.add.container(width / 2, height / 2).setDepth(91).setScale(0);
    this.tweens.add({ targets: panel, scale: 1, duration: 380, ease: 'Back.easeOut' });

    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(-230, -150, 460, 300, 28);
    panel.add(bg);

    const emoji = this.add.text(0, -86, '\uD83C\uDF55', { fontSize: '64px' }).setOrigin(0.5);
    const title = this.add.text(0, -20, 'Great Job!', {
      fontSize: '40px',
      fontFamily: 'Fredoka, sans-serif',
      fontStyle: 'bold',
      color: '#0f3d5c',
    }).setOrigin(0.5);
    const starText = this.add.text(0, 28, '\u2B50'.repeat(Math.max(stars, 1)), {
      fontSize: '40px',
    }).setOrigin(0.5);
    panel.add([emoji, title, starText]);

    this.createPillButton(width / 2, height / 2 + 100, 'Play Again \uD83D\uDD04', {
      fontSize: '28px',
      paddingX: 32,
      paddingY: 16,
      depth: 92,
    }).on('pointerup', () => this.scene.restart());
  }
}

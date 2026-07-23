// uiHelpers.js
import * as Phaser from 'phaser';

// ---------------------------------------------------------------------
// Reusable rounded "pill" button/chip — Phaser's built-in Text
// backgroundColor is always a flat, square-cornered rectangle, which is
// why plain text-with-background looked out of place next to the rest of
// the app's rounded, shadowed buttons. This draws a real rounded rect
// with a drop "step" shadow and press feedback (the shadow ducks under
// the button on press, same idea as the CSS active:shadow-none buttons
// used everywhere else in the app), and works equally well as a static
// status chip (interactive: false) or a tappable button.
//
// Takes `scene` explicitly (instead of being a method that closes over
// `this`) so both LevelSelectScene and NumberOrderScene can share one
// implementation.
// ---------------------------------------------------------------------
export function createPillButton(scene, x, y, initialLabel, opts = {}) {
  const {
    fontSize = '20px',
    bgColor = 0xffffff,
    textColor = '#173b59',
    paddingX = 18,
    paddingY = 10,
    anchor = 'center',
    borderColor = null,
    depth = 20,
    interactive = true,
    minWidth = 0,
    simple = false,
    minHeight = 0,
circle = false,
  } = opts;

  const text = scene.add.text(0, 0, initialLabel, {
    fontSize,
    fontFamily: 'Fredoka, sans-serif',
    color: textColor,
    fontStyle: 'bold',
  }).setOrigin(0.5);

let w = Math.max(text.width + paddingX * 2, minWidth);
let h = Math.max(text.height + paddingY * 2, minHeight);

if (circle) {
  const size = Math.max(w, h);
  w = size;
  h = size;
}

const radius = h / 2;
  let currentBg = bgColor;

  // ox/oy = where the pill's CENTER sits, relative to the container's
  // origin (x,y), given which corner/edge that origin represents.
  const offsetFor = (ww) => {
    if (anchor === 'topLeft') return { ox: ww / 2, oy: h / 2 };
    if (anchor === 'topRight') return { ox: -ww / 2, oy: h / 2 };
    return { ox: 0, oy: 0 };
  };
  let { ox, oy } = offsetFor(w);
  text.setPosition(ox, oy);

  const shadow = scene.add.graphics();
  const bgGfx = scene.add.graphics();

  const redraw = () => {
  shadow.clear();
  bgGfx.clear();

  shadow.fillStyle(0x000000, 0.18);

  if (circle) {
    shadow.fillCircle(ox, oy + 4, w / 2);

    bgGfx.fillStyle(currentBg, 1);
    bgGfx.fillCircle(ox, oy, w / 2);

    if (borderColor !== null) {
      bgGfx.lineStyle(3, borderColor, 1);
      bgGfx.strokeCircle(ox, oy, w / 2 - 1.5);
    }
  } else {
    shadow.fillRoundedRect(
      ox - w / 2,
      oy - h / 2 + 4,
      w,
      h,
      radius
    );

    bgGfx.fillStyle(currentBg, 1);
    bgGfx.fillRoundedRect(
      ox - w / 2,
      oy - h / 2,
      w,
      h,
      radius
    );

    if (borderColor !== null) {
      bgGfx.lineStyle(3, borderColor, 1);
      bgGfx.strokeRoundedRect(
        ox - w / 2,
        oy - h / 2,
        w,
        h,
        radius
      );
    }
  }
};
  redraw();

  const container = scene.add.container(x, y, [shadow, bgGfx, text]).setDepth(depth);

  const HIT_SLOP = 10;
  const applyHitArea = () => {
    const hitW = w + HIT_SLOP * 2;
    const hitH = h + 4 + HIT_SLOP * 2;
    const rect = new Phaser.Geom.Rectangle(ox - hitW / 2, oy - hitH / 2, hitW, hitH);
    if (interactive) {
      container.setInteractive({
        hitArea: rect,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    }
  };
  applyHitArea();

  if (interactive && !simple) {
    container.on('pointerdown', () => {
      scene.tweens.killTweensOf([bgGfx, text]);
      scene.tweens.add({
        targets: [bgGfx, text],
        y: oy + 3,
        duration: 60,
      });
      shadow.setAlpha(0.4);
    });

    container.on('pointerup', () => {
      scene.tweens.killTweensOf([bgGfx, text]);
      scene.tweens.add({
        targets: [bgGfx, text],
        y: oy,
        duration: 90,
      });
      shadow.setAlpha(1);
    });

    container.on('pointerout', () => {
      scene.tweens.killTweensOf([bgGfx, text]);
      scene.tweens.add({
        targets: [bgGfx, text],
        y: oy,
        duration: 90,
      });
      shadow.setAlpha(1);
    });
  }

  return {
    container,
    width: () => w,
    setText: (str) => {
      text.setText(str);
    w = Math.max(text.width + paddingX * 2, minWidth);
h = Math.max(text.height + paddingY * 2, minHeight);

if (circle) {
  const size = Math.max(w, h);
  w = size;
  h = size;
}
      ({ ox, oy } = offsetFor(w));
      text.setPosition(ox, oy);
      redraw();
      applyHitArea();
    },
    setBg: (colorHex) => {
      currentBg = colorHex;
      redraw();
    },
    on: (evt, cb) => container.on(evt, cb),
    destroy: () => container.destroy(),
  };
}

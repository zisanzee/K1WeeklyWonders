// world.js
// Game 15 — pure shelf/world maths. No Phaser, no DOM, so the layout can be unit
// tested: how long the world is, where each product sits, and how far the camera
// may travel.
//
// The camera slides along one world while the character stays put on screen.
// Three rules drive the layout:
//
//   1. The product row is CENTRED on the shelf, so the gap between the left
//      upright and the first product equals the gap between the last product and
//      the right upright. A lopsided row looks like the shelf was cut short.
//   2. The shelf is only as long as it must be — the row plus one symmetric
//      margin at each end.
//   3. The world is WIDER than the shelf. `marginEach` of bare background sits
//      before the first upright and after the last, so the shelf never runs flush
//      to the edge of the explorable area — it reads as a shelf standing in a
//      room rather than a strip that starts and stops abruptly.

// Width of one product cell (the slot a single product occupies). Purely a
// function of the on-screen sizing, so `visible` products always fit on screen.
export function cellWidth(screenWidth, count, visible) {
  return screenWidth / visible;
}

// Lays the world out.
//
// Returns:
//   cell            one product slot, px
//   pad             gap between the product row and EACH upright, px (symmetric)
//   productsWidth   the full row, px
//   shelfWidth      the shelving artwork's width, px
//   marginEach      bare background before/after the shelf, px
//   shelfStart      world x where the shelving begins (== marginEach)
//   productCenters  world x of each product's centre (shelf space + shelfStart)
//   cameraMin/Max   where the camera may slide to
//   worldWidth      shelf + both margins
export function shelfLayout({
  screenWidth,
  count,
  visible,
  minPad = 0,
  marginEach = 0,
}) {
  const cell = cellWidth(screenWidth, count, visible);
  const productsWidth = cell * count;
  // One symmetric margin inside the shelf, so the row is centred by construction.
  const pad = Math.max(0, minPad);
  const shelfWidth = productsWidth + pad * 2;

  const margin = Math.max(0, marginEach);
  const shelfStart = margin;
  const worldWidth = shelfWidth + margin * 2;

  // Product centres are offset by the leading background margin, so everything
  // downstream (hit tests, spotlights) works in true world coordinates.
  const productCenters = Array.from(
    { length: count },
    (_, i) => shelfStart + pad + (i + 0.5) * cell
  );

  // The camera shows the world from its left edge to its right edge — the
  // minimum travel that reveals every product and both background margins.
  const cameraMin = 0;
  const cameraMax = Math.max(0, worldWidth - screenWidth);

  return {
    cell,
    pad,
    productsWidth,
    shelfWidth,
    marginEach: margin,
    shelfStart,
    productCenters,
    cameraMin,
    cameraMax,
    worldWidth,
  };
}

// Which product's slot contains a given world x. Clamped to the ends so a point
// outside the row still reports a real product.
export function productIndexAt(worldX, layout) {
  const { cell, pad, shelfStart, productCenters } = layout;
  const raw = Math.floor((worldX - shelfStart - pad) / cell);
  return Math.min(productCenters.length - 1, Math.max(0, raw));
}

// The product under the character. The world point beneath it is
// `cameraX + characterScreenX`.
export function focusedProductIndex(cameraX, characterScreenX, layout) {
  return productIndexAt(cameraX + characterScreenX, layout);
}

// Clamp a camera offset into its bounds.
export function clampCamera(x, layout) {
  return Math.min(layout.cameraMax, Math.max(layout.cameraMin, x));
}

// "1st", "2nd", "3rd", "4th"… Handles the 11-13 exceptions, where the suffix is
// always "th" regardless of the last digit.
export function ordinalLabel(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// True when every product centre is on screen at some camera position. The
// layout guarantees this; it is exported so the tests can assert it rather than
// trusting the construction.
export function allProductsVisible(layout, screenWidth) {
  return layout.productCenters.every(
    (x) => x >= layout.cameraMin && x <= layout.cameraMax + screenWidth
  );
}

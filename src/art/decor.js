import { ellipse, paddedSheet, px } from './paint.js';

// Small decorations scattered by Level over exposed ground (§7): "top" pieces stand on a surface
// (drawn in the empty tile above it, anchored to its bottom); "hang" pieces dangle under a ledge
// (drawn in the empty tile below, anchored to its top). Decoration only: no collision, drawn behind
// every entity, and kept small and low-contrast so it never reads as a pickup or hazard.

// --- Standing pieces (bottom row of the frame is the ground line, y = 15) ---

const tuft = (light, dark) => (ctx, ox) => {
  for (const [x, h, c] of [[5, 4, dark], [6, 6, light], [8, 5, light], [9, 3, dark], [11, 4, light]]) px(ctx, ox + x, 16 - h, 1, h, c);
};

const flower = (petal, center, stem = '#3f9a3a') => (ctx, ox) => {
  px(ctx, ox + 8, 10, 1, 6, stem);
  px(ctx, ox + 9, 13, 2, 1, stem); // leaf
  px(ctx, ox + 7, 8, 3, 1, petal);
  px(ctx, ox + 7, 10, 3, 1, petal);
  px(ctx, ox + 6, 9, 1, 1, petal);
  px(ctx, ox + 10, 9, 1, 1, petal);
  px(ctx, ox + 8, 9, 1, 1, center);
};

const mushroom = (cap, dots, stalk = '#efe2c8') => (ctx, ox) => {
  px(ctx, ox + 7, 12, 2, 4, stalk);
  px(ctx, ox + 5, 10, 6, 2, cap);
  px(ctx, ox + 6, 9, 4, 1, cap);
  px(ctx, ox + 6, 10, 1, 1, dots);
  px(ctx, ox + 9, 9, 1, 1, dots);
};

const rocks = (light, dark) => (ctx, ox) => {
  px(ctx, ox + 4, 13, 5, 3, dark);
  px(ctx, ox + 5, 12, 3, 1, dark);
  px(ctx, ox + 5, 13, 2, 1, light);
  px(ctx, ox + 9, 14, 3, 2, dark);
  px(ctx, ox + 9, 14, 1, 1, light);
};

const crystals = (body, light) => (ctx, ox) => {
  for (const [x, h] of [[6, 5], [8, 7], [10, 4]]) {
    px(ctx, ox + x, 16 - h, 2, h, body);
    px(ctx, ox + x, 16 - h, 1, h - 1, light);
  }
};

const fern = (light, dark) => (ctx, ox) => {
  px(ctx, ox + 8, 8, 1, 8, dark);
  for (let i = 0; i < 4; i++) {
    const y = 9 + i * 2;
    const w = 4 - Math.floor(i / 2);
    px(ctx, ox + 8 - w, y, w, 1, light);
    px(ctx, ox + 9, y + 1, w, 1, light);
  }
};

const thorns = (color) => (ctx, ox) => {
  px(ctx, ox + 6, 11, 1, 5, color);
  px(ctx, ox + 7, 12, 3, 1, color);
  px(ctx, ox + 10, 10, 1, 3, color);
  px(ctx, ox + 5, 12, 1, 1, color);
  px(ctx, ox + 11, 9, 1, 1, color);
};

const column = (stone, light) => (ctx, ox) => {
  px(ctx, ox + 5, 9, 6, 7, stone);
  px(ctx, ox + 5, 9, 1, 7, light);
  px(ctx, ox + 4, 14, 8, 2, light);
  px(ctx, ox + 6, 8, 2, 1, stone); // broken top
  px(ctx, ox + 9, 8, 1, 1, stone);
};

const candle = (ctx, ox) => {
  px(ctx, ox + 7, 11, 3, 5, '#e9dcc0');
  px(ctx, ox + 7, 11, 1, 5, '#fff3dc');
  px(ctx, ox + 8, 10, 1, 1, '#2a2030'); // wick
  px(ctx, ox + 8, 8, 1, 2, '#ffb347');
  px(ctx, ox + 8, 7, 1, 1, '#fff1a0');
  px(ctx, ox + 6, 15, 5, 1, '#c9b89c'); // wax drip
};

// --- Hanging pieces (top row of the frame is the ceiling line, y = 0) ---

const roots = (color) => (ctx, ox) => {
  px(ctx, ox + 4, 0, 1, 5, color);
  px(ctx, ox + 5, 4, 1, 3, color);
  px(ctx, ox + 10, 0, 1, 3, color);
  px(ctx, ox + 11, 2, 1, 4, color);
  px(ctx, ox + 12, 5, 1, 2, color);
};

const vine = (stem, leaf) => (ctx, ox) => {
  px(ctx, ox + 7, 0, 1, 10, stem);
  for (const [x, y] of [[5, 2], [8, 5], [5, 8]]) px(ctx, ox + x, y, 2, 2, leaf);
  px(ctx, ox + 7, 10, 1, 1, leaf);
};

const drips = (stone, light) => (ctx, ox) => {
  for (const [x, h] of [[4, 4], [8, 6], [12, 3]]) {
    for (let row = 0; row < h; row++) px(ctx, ox + x, row, Math.max(1, Math.round(2 - (row / h) * 2)), 1, stone);
  }
  px(ctx, ox + 8, 0, 1, 3, light);
};

const chain = (link, shine) => (ctx, ox) => {
  for (let y = 0; y < 12; y += 3) {
    px(ctx, ox + 7, y, 2, 2, link);
    px(ctx, ox + 7, y, 1, 1, shine);
  }
};

const cobweb = (ctx, ox) => {
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) px(ctx, ox + 1 + i, i, 1, 1, '#d8d0e8');
  for (let i = 0; i < 5; i++) px(ctx, ox + 1, i, 1, 1, '#d8d0e8');
  px(ctx, ox + 1, 0, 8, 1, '#d8d0e8');
  px(ctx, ox + 1, 4, 4, 1, '#d8d0e8');
  ctx.globalAlpha = 1;
};

const wisp = (ctx, ox) => {
  ellipse(ctx, ox + 8, 2, 6, 2, '#ffffff');
  ellipse(ctx, ox + 6, 4, 3, 1, '#f3e8fa');
};

// Per world: standing and hanging pieces. Order doesn't matter; Level picks by position hash.
const SETS = {
  1: {
    top: [tuft('#8be37a', '#3f9a3a'), tuft('#8be37a', '#3f9a3a'), flower('#ffe066', '#e8a33a'), flower('#ff9ec4', '#ffe066'), flower('#ffffff', '#ffd23f'), mushroom('#e8434f', '#fff3e0'), rocks('#c9b8a0', '#8a7a68')],
    hang: [roots('#5e3b1c'), vine('#3f9a3a', '#5cc94e')],
  },
  2: {
    top: [tuft('#5fa04f', '#2c5a2a'), fern('#4f8a45', '#2c5a2a'), mushroom('#b5793f', '#f0d9b0'), thorns('#2a3a24'), rocks('#7d6a55', '#4a3a2a')],
    hang: [roots('#3a2a1a'), vine('#2c5a2a', '#4f8a45'), roots('#3a2a1a')],
  },
  3: {
    top: [crystals('#4f7f96', '#8fc2d6'), crystals('#6a5a9a', '#a796d4'), rocks('#6a6890', '#3b3a52'), mushroom('#4a6fb0', '#a8d0ff', '#8a96b8')],
    hang: [drips('#3b3a52', '#6a6890'), drips('#3b3a52', '#6a6890')],
  },
  4: {
    top: [tuft('#d6cbef', '#9584b8'), flower('#ff8fb1', '#fff1a0', '#9584b8'), flower('#ffffff', '#ffd9a8', '#9584b8'), column('#e3d6f0', '#ffffff')],
    hang: [wisp, vine('#9584b8', '#d6cbef')],
  },
  5: {
    top: [tuft('#8c7a6a', '#4e4038'), mushroom('#7e4fa8', '#e0c8ff', '#b8a8c8'), candle, rocks('#6d5a7e', '#3a2c48')],
    hang: [chain('#5a5068', '#9a90b0'), cobweb, roots('#2e2238')],
  },
};

const sheets = new Map();

/**
 * The world's decoration sheet: `top` frames first, then `hang`.
 * @returns {{ sheet: SpriteSheet, top: number, hang: number }} Frame counts per kind.
 */
export const decor = (world) => {
  if (sheets.has(world)) return sheets.get(world);
  const set = SETS[world] ?? SETS[1];
  const painters = [...set.top, ...set.hang];
  const sheet = paddedSheet(painters.length, 16, 16, (ctx, ox, i) => painters[i](ctx, ox));
  const out = { sheet, top: set.top.length, hang: set.hang.length };
  sheets.set(world, out);
  return out;
};

/** Frame counts without painting, for Level's placement (headless-safe). */
export const decorCounts = (world) => {
  const set = SETS[world] ?? SETS[1];
  return { top: set.top.length, hang: set.hang.length };
};

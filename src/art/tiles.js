import { WORLDS } from '../config.js';
import { hash2, paddedSheet, px } from './paint.js';

// One 16×16 tile sheet per world, painted from the world palette (§5.2, §7).
// Ground tiles are autotiled: each exposed side gets an edge (outline, rim light or shadow), an
// exposed top gets the world's cap (grass, moss, stone lip, marble trim), and corners round off.
// The dark outline keeps terrain readable over the busier parallax backdrops.

export const TILE = {
  brick: 0,
  oneWay: 1,
  spikes: 2,
  redOn: 3,
  redOff: 4,
  blueOn: 5,
  blueOff: 6,
  cannonL: 7,
  cannonR: 8,
  crumble: 9,
  switchBlock: 10,
  crack: 11, // overlay on fake walls: the hint that something is behind (§5.3 gem visibility)
};
const GROUND = 16; // first autotiled ground frame
const VARIANTS = 2;

// Exposed-side bits for ground autotiling.
export const OPEN = { top: 1, right: 2, bottom: 4, left: 8 };

/** Frame for a ground tile with the given exposed sides (OPEN bits) and texture variant. */
export const groundFrame = (mask, variant) => GROUND + mask * VARIANTS + (variant % VARIANTS);

const BRICK = GROUND + 16 * VARIANTS; // first autotiled brick frame

/** Frame for a brick tile with the given exposed sides (OPEN bits). */
export const brickFrame = (mask) => BRICK + mask;

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// What each world is built from. Colours come from WORLDS (config.js); this picks the look.
const MATERIAL = {
  1: { kind: 'soil', ledge: 'wood', brick: ['#d9822b', '#f0a75a', '#8c4f17'] },
  2: { kind: 'soil', ledge: 'wood', brick: ['#7a5a3a', '#9c7a52', '#46301c'] },
  3: { kind: 'rock', ledge: 'stone', brick: ['#55546f', '#77769a', '#2a2940'] },
  4: { kind: 'marble', ledge: 'cloud', brick: ['#d4c2e6', '#f3eafb', '#9a84b8'] },
  5: { kind: 'castle', ledge: 'iron', brick: ['#5c4a6e', '#7d6992', '#2a1f36'] },
};

// --- Ground textures (inside of a tile) ---

const soil = (ctx, ox, pal, seed) => {
  const dark = shade(pal.ground, -0.25);
  const light = shade(pal.ground, 0.15);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash2(seed, i) * 13) + 1;
    const y = Math.floor(hash2(i, seed) * 12) + 3;
    px(ctx, ox + x, y, 2, 1, dark);
    px(ctx, ox + x, y - 1, 1, 1, light);
  }
  // A pebble.
  const x = 3 + Math.floor(hash2(seed, 9) * 9);
  const y = 7 + Math.floor(hash2(9, seed) * 6);
  px(ctx, ox + x, y, 3, 2, shade(pal.ground, 0.25));
  px(ctx, ox + x, y + 2, 3, 1, dark);
};

const rock = (ctx, ox, pal, seed) => {
  const dark = shade(pal.ground, -0.3);
  const light = shade(pal.ground, 0.16);
  // Darker patches, a jagged crack and a few lit chips: rough stone rather than a tidy grid.
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(hash2(seed, i + 20) * 11) + 1;
    const y = Math.floor(hash2(i + 20, seed) * 11) + 2;
    px(ctx, ox + x, y, 3 + (i % 2), 2, shade(pal.ground, -0.12));
  }
  let x = 2 + Math.floor(hash2(seed, 30) * 6);
  for (let y = 3; y < 13; y++) {
    if (hash2(y, seed) > 0.6) x += hash2(seed, y) > 0.5 ? 1 : -1;
    px(ctx, ox + Math.max(1, Math.min(14, x)), y, 1, 1, dark);
  }
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(hash2(seed, i + 40) * 13) + 1;
    const cy = Math.floor(hash2(i + 40, seed) * 12) + 2;
    px(ctx, ox + cx, cy, 2, 1, light);
    px(ctx, ox + cx, cy + 1, 2, 1, dark);
  }
};

const marble = (ctx, ox, pal, seed) => {
  const seam = shade(pal.ground, -0.18);
  const vein = shade(pal.ground, -0.08);
  px(ctx, ox, 7, 16, 1, seam);
  px(ctx, ox, 15, 16, 1, seam);
  px(ctx, ox + (seed % 2 ? 9 : 5), 0, 1, 7, seam);
  px(ctx, ox + (seed % 2 ? 3 : 12), 8, 1, 7, seam);
  // A faint vein.
  for (let i = 0; i < 5; i++) px(ctx, ox + 2 + i * 2, 10 + Math.round(Math.sin(i + seed) * 1.5), 2, 1, vein);
};

const castle = (ctx, ox, pal, seed) => {
  const mortar = shade(pal.ground, -0.35);
  const light = shade(pal.ground, 0.12);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    px(ctx, ox, y + 3, 16, 1, mortar);
    const off = (row + seed) % 2 ? 0 : 4;
    for (let x = off; x < 16; x += 8) px(ctx, ox + x, y, 1, 3, mortar);
    px(ctx, ox + off + 1, y, 3, 1, light);
  }
};

const TEXTURE = { soil, rock, marble, castle };

// --- Caps on exposed tops ---

const grassCap = (ctx, ox, pal, mask, seed) => {
  const top = pal.top;
  const light = shade(top, 0.3);
  const dark = shade(top, -0.3);
  px(ctx, ox, 0, 16, 4, top);
  px(ctx, ox, 0, 16, 1, light);
  // Ragged lower edge.
  for (let x = 0; x < 16; x++) {
    const drop = hash2(x, seed) > 0.55 ? 1 : 0;
    if (drop) px(ctx, ox + x, 4, 1, 1, top);
    px(ctx, ox + x, 4 + drop, 1, 1, dark);
  }
  px(ctx, ox + 3 + seed, 2, 1, 1, dark);
  px(ctx, ox + 11 - seed, 1, 1, 1, light);
  // Grass wraps a little way down exposed sides.
  if (mask & OPEN.left) px(ctx, ox, 4, 2, 3, top);
  if (mask & OPEN.right) px(ctx, ox + 14, 4, 2, 3, top);
};

const lipCap = (ctx, ox, pal, _mask, seed, material) => {
  const top = pal.top;
  px(ctx, ox, 0, 16, 3, top);
  px(ctx, ox, 0, 16, 1, shade(top, 0.3));
  px(ctx, ox, 3, 16, 1, shade(top, -0.35));
  if (material.kind === 'marble') {
    // Carved trim: a dotted band.
    for (let x = 1; x < 16; x += 3) px(ctx, ox + x, 1, 1, 1, shade(top, -0.2));
  } else if (material.kind === 'castle') {
    // Moss on the battlements.
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash2(seed, i + 4) * 14);
      px(ctx, ox + x, 0, 2 + (i % 2), 1, '#6f9a52');
      px(ctx, ox + x, 1, 1, 1, '#4d7340');
    }
  } else {
    for (let i = 0; i < 2; i++) px(ctx, ox + Math.floor(hash2(seed, i + 7) * 14), 2, 2, 1, shade(top, -0.2));
  }
};

const CAP = { soil: grassCap, rock: lipCap, marble: lipCap, castle: lipCap };

/** An autotiled ground tile: texture, exposed edges, top cap, rounded corners. */
const ground = (ctx, ox, pal, material, mask, variant) => {
  const seed = variant * 5 + 1;
  const outline = shade(pal.ground, -0.6);
  px(ctx, ox, 0, 16, 16, pal.ground);
  TEXTURE[material.kind](ctx, ox, pal, seed);
  if (mask & OPEN.left) {
    px(ctx, ox, 0, 1, 16, outline);
    px(ctx, ox + 1, 0, 1, 16, shade(pal.ground, 0.15));
  }
  if (mask & OPEN.right) {
    px(ctx, ox + 15, 0, 1, 16, outline);
    px(ctx, ox + 14, 0, 1, 16, shade(pal.ground, -0.2));
  }
  if (mask & OPEN.bottom) {
    px(ctx, ox, 13, 16, 2, shade(pal.ground, -0.25));
    px(ctx, ox, 15, 16, 1, outline);
  }
  if (mask & OPEN.top) {
    CAP[material.kind](ctx, ox, pal, mask, variant, material);
    px(ctx, ox, 0, 16, 1, shade(pal.top, -0.55)); // outline above the cap
    px(ctx, ox, 1, 16, 1, shade(pal.top, 0.3));
    if (mask & OPEN.left) px(ctx, ox, 0, 1, 7, shade(pal.top, -0.55));
    if (mask & OPEN.right) px(ctx, ox + 15, 0, 1, 7, shade(pal.top, -0.55));
  }
  // Round off outside corners.
  const cut = (x, y) => ctx.clearRect(ox + x, y, 1, 1);
  if (mask & OPEN.top && mask & OPEN.left) cut(0, 0);
  if (mask & OPEN.top && mask & OPEN.right) cut(15, 0);
  if (mask & OPEN.bottom && mask & OPEN.left) cut(0, 15);
  if (mask & OPEN.bottom && mask & OPEN.right) cut(15, 15);
};

// --- Other tiles ---

/**
 * A brick tile, autotiled like the ground: the courses line up across neighbouring bricks, so a
 * stack reads as one wall, and only exposed sides get an outline.
 */
const brick = (ctx, ox, [base, light, dark], mask) => {
  const outline = shade(dark, -0.45);
  px(ctx, ox, 0, 16, 16, base);
  for (const y of [0, 8]) px(ctx, ox, y, 16, 1, light); // each course catches the light on top
  for (const y of [7, 15]) px(ctx, ox, y, 16, 1, dark); // mortar between courses
  px(ctx, ox + 7, 0, 1, 7, dark);
  px(ctx, ox + 3, 8, 1, 7, dark);
  px(ctx, ox + 11, 8, 1, 7, dark);
  px(ctx, ox + 1, 2, 2, 1, light);
  px(ctx, ox + 9, 10, 2, 1, light);
  if (mask & OPEN.top) px(ctx, ox, 0, 16, 1, outline);
  if (mask & OPEN.bottom) px(ctx, ox, 15, 16, 1, outline);
  if (mask & OPEN.left) px(ctx, ox, 0, 1, 16, outline);
  if (mask & OPEN.right) px(ctx, ox + 15, 0, 1, 16, outline);
  const cut = (x, y) => ctx.clearRect(ox + x, y, 1, 1);
  if (mask & OPEN.top && mask & OPEN.left) cut(0, 0);
  if (mask & OPEN.top && mask & OPEN.right) cut(15, 0);
  if (mask & OPEN.bottom && mask & OPEN.left) cut(0, 15);
  if (mask & OPEN.bottom && mask & OPEN.right) cut(15, 15);
};

// One-way ledges: thin, with a clear top edge, styled per world.
const LEDGE = {
  wood: (ctx, ox) => {
    px(ctx, ox, 0, 16, 5, '#c08a4b');
    px(ctx, ox, 0, 16, 1, '#e8b678');
    px(ctx, ox, 4, 16, 1, '#7a5530');
    px(ctx, ox + 7, 1, 1, 3, '#9c6c3a'); // plank joint
    px(ctx, ox + 2, 5, 2, 2, '#7a5530');
    px(ctx, ox + 12, 5, 2, 2, '#7a5530');
  },
  stone: (ctx, ox) => {
    px(ctx, ox, 0, 16, 5, '#6a6890');
    px(ctx, ox, 0, 16, 1, '#9a98c4');
    px(ctx, ox, 4, 16, 1, '#2f2e46');
    px(ctx, ox + 5, 1, 1, 3, '#4b4a68');
    px(ctx, ox + 12, 1, 1, 3, '#4b4a68');
  },
  cloud: (ctx, ox) => {
    for (const [x, r] of [[3, 3], [8, 4], [13, 3]]) {
      px(ctx, ox + x - r, 2 - (r - 3), r * 2, 4, '#ffffff');
    }
    px(ctx, ox, 3, 16, 3, '#ffffff');
    px(ctx, ox, 5, 16, 1, '#e3d4ee');
    px(ctx, ox + 2, 1, 3, 1, '#ffffff');
  },
  iron: (ctx, ox) => {
    px(ctx, ox, 0, 16, 4, '#3d3550');
    px(ctx, ox, 0, 16, 1, '#7a6f95');
    px(ctx, ox, 3, 16, 1, '#1d1828');
    for (const x of [1, 14]) px(ctx, ox + x, 1, 1, 1, '#a99ec4'); // rivets
    for (let x = 3; x < 14; x += 3) px(ctx, ox + x, 4, 1, 3, '#2a2338'); // grate bars
  },
};

// Hazards: light-grey base with red tips (§7). Two spikes per tile; the lower half is what hurts.
const spikes = (ctx, ox) => {
  for (const base of [0, 8]) {
    for (let row = 0; row < 9; row++) {
      const width = Math.min(8, 2 * Math.ceil((row + 1) / 2));
      px(ctx, ox + base + 4 - width / 2, 7 + row, width, 1, row > 6 ? '#a9a9b8' : '#dcdce6');
    }
    px(ctx, ox + base + 3, 7, 2, 2, '#ff3b3b');
    px(ctx, ox + base + 4, 9, 1, 3, '#ffffff');
  }
};

// Switch blocks differ by pattern as well as colour (§9.5): dots for red, stripes for blue.
const switchBlock = (ctx, ox, color, dark, pattern, on) => {
  if (!on) {
    for (let i = 0; i < 16; i += 4) {
      px(ctx, ox + i, 0, 2, 1, color);
      px(ctx, ox + i + 2, 15, 2, 1, color);
      px(ctx, ox, i + 2, 1, 2, color);
      px(ctx, ox + 15, i, 1, 2, color);
    }
    return;
  }
  px(ctx, ox, 0, 16, 16, dark);
  px(ctx, ox + 1, 1, 14, 14, color);
  if (pattern === 'dots') for (const [x, y] of [[4, 4], [10, 4], [7, 7], [4, 10], [10, 10]]) px(ctx, ox + x, y, 2, 2, dark);
  else for (let i = 2; i < 14; i += 4) px(ctx, ox + 2, i, 12, 2, dark);
  px(ctx, ox + 1, 1, 14, 1, 'rgba(255,255,255,0.5)');
};

const cannon = (ctx, ox, dir) => {
  px(ctx, ox, 0, 16, 16, '#5a4a3a');
  px(ctx, ox + 1, 1, 14, 14, '#7d6650');
  px(ctx, ox + 1, 1, 14, 2, '#9c8266');
  const bx = dir < 0 ? 0 : 6;
  px(ctx, ox + bx, 4, 10, 8, '#2b2b35');
  px(ctx, ox + bx + (dir < 0 ? 0 : 8), 5, 2, 6, '#111');
  px(ctx, ox + bx + 2, 4, 6, 1, '#555c6b');
};

const crumbleBlock = (ctx, ox, pal) => {
  px(ctx, ox, 0, 16, 16, shade(pal.ground, -0.15));
  px(ctx, ox + 1, 1, 14, 14, shade(pal.ground, 0.1));
  const c = shade(pal.ground, -0.5);
  px(ctx, ox + 4, 1, 1, 5, c);
  px(ctx, ox + 5, 6, 3, 1, c);
  px(ctx, ox + 8, 6, 1, 5, c);
  px(ctx, ox + 9, 11, 4, 1, c);
  px(ctx, ox + 12, 3, 1, 4, c);
  px(ctx, ox + 2, 10, 4, 1, c);
};

const switchTile = (ctx, ox) => {
  px(ctx, ox, 0, 16, 16, '#3a3040');
  px(ctx, ox + 1, 1, 14, 14, '#ffd23f');
  px(ctx, ox + 1, 1, 14, 2, '#fff3b0');
  px(ctx, ox + 4, 5, 4, 6, '#e8434f');
  px(ctx, ox + 8, 5, 4, 6, '#3d7be8');
  px(ctx, ox + 1, 14, 14, 1, '#c99a12');
};

// A faint crack: enough to hint at a secret for players who look (§5.3), not enough to give it away.
const crack = (ctx, ox, pal) => {
  const c = shade(pal.ground, -0.4);
  px(ctx, ox + 7, 6, 1, 3, c);
  px(ctx, ox + 8, 9, 1, 2, c);
  px(ctx, ox + 6, 11, 1, 2, c);
};

const sheets = new Map();

/** The world's tile SpriteSheet, painted on first use. */
export const tiles = (world) => {
  if (sheets.has(world)) return sheets.get(world);
  const pal = WORLDS[world];
  const material = MATERIAL[world] ?? MATERIAL[1];
  const painters = new Array(BRICK + 16).fill(null);
  painters[TILE.brick] = (ctx, ox) => brick(ctx, ox, material.brick, 15); // a lone brick, all sides exposed
  for (let mask = 0; mask < 16; mask++) painters[brickFrame(mask)] = (ctx, ox) => brick(ctx, ox, material.brick, mask);
  painters[TILE.oneWay] = LEDGE[material.ledge];
  painters[TILE.spikes] = spikes;
  painters[TILE.redOn] = (ctx, ox) => switchBlock(ctx, ox, '#e8434f', '#8a1f2a', 'dots', true);
  painters[TILE.redOff] = (ctx, ox) => switchBlock(ctx, ox, '#e8434f', '#8a1f2a', 'dots', false);
  painters[TILE.blueOn] = (ctx, ox) => switchBlock(ctx, ox, '#3d7be8', '#1b3f8a', 'stripes', true);
  painters[TILE.blueOff] = (ctx, ox) => switchBlock(ctx, ox, '#3d7be8', '#1b3f8a', 'stripes', false);
  painters[TILE.cannonL] = (ctx, ox) => cannon(ctx, ox, -1);
  painters[TILE.cannonR] = (ctx, ox) => cannon(ctx, ox, 1);
  painters[TILE.crumble] = (ctx, ox) => crumbleBlock(ctx, ox, pal);
  painters[TILE.switchBlock] = switchTile;
  painters[TILE.crack] = (ctx, ox) => crack(ctx, ox, pal);
  for (let mask = 0; mask < 16; mask++) {
    for (let v = 0; v < VARIANTS; v++) painters[groundFrame(mask, v)] = (ctx, ox) => ground(ctx, ox, pal, material, mask, v);
  }
  const sheet = paddedSheet(painters.length, 16, 16, (ctx, ox, i) => painters[i]?.(ctx, ox));
  sheets.set(world, sheet);
  return sheet;
};

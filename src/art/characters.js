import { SpriteSheet } from '../../vendor/h3-engine.min.js';
import { canvas, ellipse, grid, px } from './paint.js';

// One shared 16×16 characters sheet (§7: few shared sheets keep Canvas 2D batching intact).
// Frames face right; draw with flipX to face left.

const HOP = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkrrrrrrkk...',
  '..krrllrrrrrrk..',
  '..krlrrrrrrrrk..',
  '.krrrrrEEEEEErk.',
  '.krrrrrEEEEEErk.',
  '.krrrrrEEEEEErk.',
  '.krrrrrEEEEEErk.',
  '.krrrrrrrrrrrrk.',
  '.krrnrrrrrrnrrk.',
  '.kdrrrrrrrrrrdk.',
  '..kddrrrrrrddk..',
  '...kkddddddkk...',
  '....kkkkkkkk....',
];
// Eye block (cols 7–12, rows 6–9), one per expression.
const EYES = {
  idle: ['wwrrww', 'wprrwp', 'wprrwp', 'wwrrww'],
  blink: ['rrrrrr', 'rrrrrr', 'kkrrkk', 'rrrrrr'],
  up: ['wprrwp', 'wprrwp', 'wwrrww', 'wwrrww'],
  down: ['wwrrww', 'wwrrww', 'wprrwp', 'wprrwp'],
  hurt: ['rrrrrr', 'kkrrkk', 'rkrrrk', 'rrrrrr'],
  slide: ['wwrrww', 'pwrrpw', 'pwrrpw', 'wwrrww'],
};
const HOP_PAL = { k: '#3a1020', r: '#ff5e5b', l: '#ffa59a', d: '#c8383d', n: '#ff8a9a', w: '#ffffff', p: '#1d1d2b' };

const SLIME = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kggllggggk...',
  '..kgllgggggggk..',
  '..kgggwpgwpggk..',
  '..kgggwpgwpggk..',
  '.kgggggggggggggk',
  '.kgggggggggggggk',
  '.kdgggggggggggdk',
  '.kddddddddddddk.',
  '..kkkkkkkkkkkk..',
];
const SLIME_PAL = { k: '#1e3a17', g: '#4fbf3f', l: '#a6ec8f', d: '#2f8a2a', w: '#ffffff', p: '#123' };
const HOPPER_PAL = { ...SLIME_PAL, k: '#14284a', g: '#4aa3ff', l: '#a9d8ff', d: '#2a6fc0' };

// Gloop Knight: a slime in a tin helmet (§4.3).
const HELMET = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kssllssk....',
  '...ksslsssssk...',
  '...ksssssssssk..',
  '..kkkkkkkkkkkk..',
];
const HELMET_PAL = { s: '#b9c0cc', l: '#eef2f7', k: '#4a5060' };
const KNIGHT_PAL = { ...SLIME_PAL, k: '#2a1e3a', g: '#9b6bd6', l: '#d4b8ff', d: '#6a45a0' };

/** Draw `top` over `base` wherever `top` isn't '.'. Both are char grids. */
const overlay = (base, top) =>
  base.map((row, y) => [...row].map((ch, x) => (top[y] && top[y][x] && top[y][x] !== '.' ? `${top[y][x]}` : ch)).join(''));

const withEyes = (eyes) => HOP.map((row, y) => (y >= 6 && y <= 9 ? row.slice(0, 7) + eyes[y - 6] + row.slice(13) : row));

/** Frame indices by name. */
export const FRAMES = {
  hop_idle: 0,
  hop_blink: 1,
  hop_up: 2,
  hop_down: 3,
  hop_hurt: 4,
  hop_slide: 5,
  slime: 6,
  hopper: 7,
  knight: 8,
  knight_bare: 9,
  helmet: 10,
  thornback: 11,
  bat_sleep: 12,
  bat_up: 13,
  bat_down: 14,
  dropper: 15,
  puffer: 16,
  puffer_big: 17,
  acorn: 18,
  spore: 19,
  crystal: 20,
  seed: 21,
  rock: 22,
  goo: 23,
};
/** Add to a hop_* frame for the "Golden Hop" palette (§4.4). */
export const GOLD = 24;

// Painted creatures (procedural, so shapes stay easy to tweak).
const OUT = '#1d1d2b';
const eye = (ctx, x, y, look = 1) => {
  px(ctx, x, y, 2, 3, '#fff');
  px(ctx, x + (look > 0 ? 1 : 0), y + 1, 1, 2, OUT);
};

// Brown beetle with a spiked back: spikes = hazard (§7), light grey with red tips.
const thornback = (ctx, o) => {
  for (const x of [3, 7, 11]) {
    px(ctx, o + x, 6, 3, 2, '#dcdce6');
    px(ctx, o + x + 1, 4, 1, 2, '#dcdce6');
    px(ctx, o + x + 1, 3, 1, 1, '#ff3b3b');
  }
  ellipse(ctx, o + 8, 11, 8, 4, OUT);
  ellipse(ctx, o + 8, 11, 7, 3, '#8a5a2b');
  px(ctx, o + 2, 9, 9, 1, '#b07a44');
  eye(ctx, o + 12, 9);
  for (const x of [3, 7, 11]) px(ctx, o + x, 14, 1, 2, OUT);
};

const batBody = (ctx, o, y) => {
  ellipse(ctx, o + 8, y, 4, 4, OUT);
  ellipse(ctx, o + 8, y, 3, 3, '#8a4fd1');
  px(ctx, o + 5, y - 5, 1, 2, OUT); // ears
  px(ctx, o + 10, y - 5, 1, 2, OUT);
  px(ctx, o + 6, y - 1, 1, 2, '#fff');
  px(ctx, o + 9, y - 1, 1, 2, '#fff');
};
const batWings = (ctx, o, y, up) => {
  const color = '#5c2f99';
  for (let i = 0; i < 4; i++) {
    const wy = up ? y - 1 - i : y - 1 + i;
    px(ctx, o + 4 - i, wy, 1, 3, color);
    px(ctx, o + 11 + i, wy, 1, 3, color);
  }
};
const batUp = (ctx, o) => (batWings(ctx, o, 9, true), batBody(ctx, o, 9));
const batDown = (ctx, o) => (batWings(ctx, o, 9, false), batBody(ctx, o, 9));
// Asleep upside down, wrapped in its wings.
const batSleep = (ctx, o) => {
  px(ctx, o + 7, 0, 1, 2, OUT);
  px(ctx, o + 9, 0, 1, 2, OUT);
  ellipse(ctx, o + 8, 6, 4, 5, OUT);
  ellipse(ctx, o + 8, 6, 3, 4, '#5c2f99');
  px(ctx, o + 6, 7, 1, 1, OUT);
  px(ctx, o + 9, 7, 1, 1, OUT);
};

// Stone stalactite with eyes. Spiky point = can't be stomped.
const dropper = (ctx, o) => {
  for (let y = 0; y < 15; y++) {
    const w = Math.max(1, Math.round(13 - y * 0.85));
    px(ctx, o + 8 - Math.ceil(w / 2), y, w, 1, y === 0 ? '#5a5a6e' : '#8a8aa0');
    px(ctx, o + 8 - Math.ceil(w / 2), y, 1, 1, OUT);
  }
  px(ctx, o + 7, 13, 2, 2, '#ff3b3b');
  px(ctx, o + 4, 4, 3, 2, '#fff');
  px(ctx, o + 9, 4, 3, 2, '#fff');
  px(ctx, o + 5, 5, 1, 1, OUT);
  px(ctx, o + 10, 5, 1, 1, OUT);
  px(ctx, o + 4, 3, 3, 1, OUT);
  px(ctx, o + 9, 3, 3, 1, OUT);
};

// Grumpy cloud.
const puffer = (big) => (ctx, o) => {
  const k = big ? 1.25 : 1;
  for (const [x, y, r] of [[5, 10, 4], [11, 10, 4], [8, 7, 5]]) ellipse(ctx, o + 8 + (x - 8) * k, y, Math.round(r * k) + 1, Math.round(r * k) + 1, '#5a6080');
  for (const [x, y, r] of [[5, 10, 4], [11, 10, 4], [8, 7, 5]]) ellipse(ctx, o + 8 + (x - 8) * k, y, Math.round(r * k), Math.round(r * k), '#e6e9f5');
  px(ctx, o + 4, 6, 3, 1, OUT); // angry brows
  px(ctx, o + 9, 6, 3, 1, OUT);
  px(ctx, o + 5, 7, 2, 2, OUT);
  px(ctx, o + 9, 7, 2, 2, OUT);
  if (big) ellipse(ctx, o + 8, 11, 2, 2, OUT); // inhaling
  else px(ctx, o + 6, 11, 4, 1, OUT);
};

const acorn = (ctx, o) => {
  ellipse(ctx, o + 8, 10, 5, 5, '#3a2410');
  ellipse(ctx, o + 8, 10, 4, 4, '#b5702e');
  px(ctx, o + 3, 5, 10, 3, '#6b4423');
  px(ctx, o + 4, 4, 8, 1, '#8a5a2b');
  px(ctx, o + 8, 2, 1, 2, '#3a2410');
  px(ctx, o + 6, 9, 1, 2, '#e0a060');
};

const spore = (ctx, o) => {
  ellipse(ctx, o + 8, 8, 3, 3, '#4a2a5a');
  ellipse(ctx, o + 8, 8, 2, 2, '#c07ae0');
  px(ctx, o + 7, 7, 1, 1, '#fff');
};

const crystal = (ctx, o) => {
  for (const [x, h] of [[5, 7], [8, 11], [11, 6]]) {
    for (let y = 0; y < h; y++) {
      const w = y < 2 ? 1 : 3;
      px(ctx, o + x - (w > 1 ? 1 : 0), 16 - h + y, w, 1, y < 2 ? '#e8fdff' : '#6fe3ff');
    }
    px(ctx, o + x, 16 - h + 2, 1, h - 2, '#b8f5ff');
  }
};

const seed = (ctx, o) => {
  ellipse(ctx, o + 8, 9, 5, 6, '#c97a00');
  ellipse(ctx, o + 8, 9, 4, 5, '#ffd23f');
  px(ctx, o + 6, 5, 2, 3, '#fff6b0');
  px(ctx, o + 8, 1, 1, 3, '#5cc94e');
  px(ctx, o + 9, 1, 2, 1, '#5cc94e');
};

const rock = (ctx, o) => {
  ellipse(ctx, o + 8, 9, 6, 5, OUT);
  ellipse(ctx, o + 8, 9, 5, 4, '#7a6a8a');
  px(ctx, o + 5, 6, 3, 1, '#a898b8');
};

const goo = (ctx, o) => {
  ellipse(ctx, o + 8, 9, 5, 4, '#2f5a1e');
  ellipse(ctx, o + 8, 9, 4, 3, '#8fd14f');
  px(ctx, o + 6, 7, 2, 1, '#d2f59c');
};

const GOLD_PAL = { ...HOP_PAL, k: '#5a3a00', r: '#ffd23f', l: '#fff3b0', d: '#d99a00', n: '#ffb627' };

let sheet = null;

/** The characters SpriteSheet, painted on first use. */
export const characters = () => {
  if (sheet) return sheet;
  const art = [
    [withEyes(EYES.idle), HOP_PAL],
    [withEyes(EYES.blink), HOP_PAL],
    [withEyes(EYES.up), HOP_PAL],
    [withEyes(EYES.down), HOP_PAL],
    [withEyes(EYES.hurt), HOP_PAL],
    [withEyes(EYES.slide), HOP_PAL],
    [SLIME, SLIME_PAL],
    [SLIME, HOPPER_PAL],
    // Helmet chars are upper-case so they don't collide with the slime palette.
    [overlay(SLIME, HELMET.map((r) => r.replace(/[skl]/g, (c) => c.toUpperCase()))), { ...KNIGHT_PAL, S: HELMET_PAL.s, L: HELMET_PAL.l, K: HELMET_PAL.k }],
    [SLIME, { ...KNIGHT_PAL, g: '#c05bd6', d: '#8a3aa0' }],
    [HELMET.map((r) => r.replace(/[skl]/g, (c) => c.toUpperCase())), { S: HELMET_PAL.s, L: HELMET_PAL.l, K: HELMET_PAL.k }],
    thornback,
    batSleep,
    batUp,
    batDown,
    dropper,
    puffer(false),
    puffer(true),
    acorn,
    spore,
    crystal,
    seed,
    rock,
    goo,
    ...['idle', 'blink', 'up', 'down', 'hurt', 'slide'].map((e) => [withEyes(EYES[e]), GOLD_PAL]),
  ];
  if (art.length !== GOLD + 6) throw new Error('characters: frame table out of sync');
  const image = canvas(16 * art.length, 16, (ctx) =>
    art.forEach((a, i) => (typeof a === 'function' ? a(ctx, i * 16) : grid(ctx, a[0], a[1], i * 16, 0))),
  );
  sheet = new SpriteSheet(image, { frameW: 16, frameH: 16, originX: 0.5, originY: 1 });
  return sheet;
};

import { SpriteSheet } from '../../vendor/h3-engine.min.js';
import { canvas, grid } from './paint.js';

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
};

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
  ];
  const image = canvas(16 * art.length, 16, (ctx) => art.forEach(([rows, pal], i) => grid(ctx, rows, pal, i * 16, 0)));
  sheet = new SpriteSheet(image, { frameW: 16, frameH: 16, originX: 0.5, originY: 1 });
  return sheet;
};

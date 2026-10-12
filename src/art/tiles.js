import { SpriteSheet } from '../../vendor/h3-engine.min.js';
import { WORLDS } from '../config.js';
import { canvas, hash2, px } from './paint.js';

// One 16×16 tile sheet per world, painted from the world palette (§5.2).

export const TILE = {
  top: 0,
  topAlt: 1,
  inner: 2,
  innerAlt: 3,
  brick: 4,
  oneWay: 5,
  spikes: 6,
  fakeTop: 7,
  fakeInner: 8,
  redOn: 9,
  redOff: 10,
  blueOn: 11,
  blueOff: 12,
  cannonL: 13,
  cannonR: 14,
  crumble: 15,
  switchBlock: 16,
};

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const dirt = (ctx, ox, pal, seed) => {
  px(ctx, ox, 0, 16, 16, pal.ground);
  const dark = shade(pal.ground, -0.25);
  const light = shade(pal.ground, 0.15);
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash2(seed, i) * 14) + 1;
    const y = Math.floor(hash2(i, seed) * 14) + 1;
    px(ctx, ox + x, y, 2, 1, dark);
    px(ctx, ox + x, y - 1, 1, 1, light);
  }
};

const grass = (ctx, ox, pal, seed) => {
  const dark = shade(pal.top, -0.3);
  const light = shade(pal.top, 0.3);
  px(ctx, ox, 0, 16, 4, pal.top);
  px(ctx, ox, 0, 16, 1, light);
  // Ragged lower edge and tufts.
  for (let x = 0; x < 16; x++) {
    const drop = hash2(x, seed) > 0.55 ? 1 : 0;
    px(ctx, ox + x, 4, 1, drop + 1, drop ? pal.top : dark);
    if (drop) px(ctx, ox + x, 5 + drop - 1, 1, 1, dark);
  }
  px(ctx, ox + 3 + seed, 1, 1, 1, dark);
  px(ctx, ox + 11 - seed, 2, 1, 1, dark);
};

const crack = (ctx, ox, pal) => {
  const c = shade(pal.ground, -0.45);
  px(ctx, ox + 7, 6, 1, 3, c);
  px(ctx, ox + 8, 9, 1, 2, c);
  px(ctx, ox + 6, 11, 1, 2, c);
};

const brick = (ctx, ox) => {
  px(ctx, ox, 0, 16, 16, '#d9822b');
  px(ctx, ox, 0, 16, 1, '#f0a75a');
  for (const y of [7, 15]) px(ctx, ox, y, 16, 1, '#8c4f17');
  px(ctx, ox + 7, 0, 1, 7, '#8c4f17');
  px(ctx, ox + 3, 8, 1, 7, '#8c4f17');
  px(ctx, ox + 11, 8, 1, 7, '#8c4f17');
  px(ctx, ox + 1, 2, 2, 1, '#f0a75a');
  px(ctx, ox + 9, 10, 2, 1, '#f0a75a');
};

const oneWay = (ctx, ox) => {
  px(ctx, ox, 0, 16, 5, '#c08a4b');
  px(ctx, ox, 0, 16, 1, '#e8b678');
  px(ctx, ox, 4, 16, 1, '#7a5530');
  px(ctx, ox + 2, 5, 2, 2, '#7a5530');
  px(ctx, ox + 12, 5, 2, 2, '#7a5530');
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
  // Barrel.
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
  // A red/blue toggle arrow.
  px(ctx, ox + 4, 5, 4, 6, '#e8434f');
  px(ctx, ox + 8, 5, 4, 6, '#3d7be8');
  px(ctx, ox + 1, 14, 14, 1, '#c99a12');
};

const sheets = new Map();

/** The world's tile SpriteSheet, painted on first use. */
export const tiles = (world) => {
  if (sheets.has(world)) return sheets.get(world);
  const pal = WORLDS[world];
  const painters = [
    (ctx, ox) => (dirt(ctx, ox, pal, 1), grass(ctx, ox, pal, 0)),
    (ctx, ox) => (dirt(ctx, ox, pal, 2), grass(ctx, ox, pal, 2)),
    (ctx, ox) => dirt(ctx, ox, pal, 3),
    (ctx, ox) => dirt(ctx, ox, pal, 4),
    brick,
    oneWay,
    spikes,
    (ctx, ox) => (dirt(ctx, ox, pal, 1), grass(ctx, ox, pal, 0), crack(ctx, ox, pal)),
    (ctx, ox) => (dirt(ctx, ox, pal, 3), crack(ctx, ox, pal)),
    (ctx, ox) => switchBlock(ctx, ox, '#e8434f', '#8a1f2a', 'dots', true),
    (ctx, ox) => switchBlock(ctx, ox, '#e8434f', '#8a1f2a', 'dots', false),
    (ctx, ox) => switchBlock(ctx, ox, '#3d7be8', '#1b3f8a', 'stripes', true),
    (ctx, ox) => switchBlock(ctx, ox, '#3d7be8', '#1b3f8a', 'stripes', false),
    (ctx, ox) => cannon(ctx, ox, -1),
    (ctx, ox) => cannon(ctx, ox, 1),
    (ctx, ox) => crumbleBlock(ctx, ox, pal),
    switchTile,
  ];
  const image = canvas(16 * painters.length, 16, (ctx) => painters.forEach((paint, i) => paint(ctx, i * 16)));
  const sheet = new SpriteSheet(image, { frameW: 16, frameH: 16 });
  sheets.set(world, sheet);
  return sheet;
};

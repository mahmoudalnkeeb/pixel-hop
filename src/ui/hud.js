import { MAX_HEARTS, VIEW_W } from '../config.js';
import { grid } from '../art/paint.js';
import { textWidth } from './font.js';
import { label } from './label.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;

// Small, chunky HUD icons (§9.2). No backing box: like the font, every icon has its own dark
// outline, so it reads over any sky or wall while staying part of the pixel-art world.
const ICONS = {
  heart: [
    '.kkk.kkk.',
    'krwrkrrrk',
    'krwrrrrrk',
    'krrrrrrdk',
    '.krrrrdk.',
    '..krrdk..',
    '...kdk...',
    '....k....',
  ],
  coin: ['..kkkk..', '.kywyyk.', 'kywyyyyk', 'kywyyydk', 'kyyyyydk', 'kyyyyddk', '.kddddk.', '..kkkk..'],
  gem: ['.kkkkkkk.', 'kwwlyyyok', 'klyyyyyok', '.klyyyok.', '..kyyok..', '...kok...', '....k....'],
  clock: ['..kkk..', '.kwwwk.', 'kwwkwwk', 'kwwkkwk', 'kwwwwwk', '.kwwwk.', '..kkk..'],
};
const OUTLINE = '#1b1426';
const PALETTES = {
  heart: { k: OUTLINE, r: '#ff5e7a', w: '#ffd0da', d: '#d03a5c' },
  heartEmpty: { k: OUTLINE, r: '#4a3a52', w: '#5c4a66', d: '#3a2c42' },
  coin: { k: OUTLINE, y: '#ffd23f', w: '#fff6b0', d: '#e09a12' },
  gem: { k: OUTLINE, w: '#fffbe6', l: '#fff1b0', y: '#ffd23f', o: '#e8890c' },
  gemEmpty: { k: OUTLINE, w: '#5c5470', l: '#4e4762', y: '#423c55', o: '#363046' },
  clock: { k: OUTLINE, w: '#e8e8f0' },
};

let icons = null;
/** Each icon is painted once into its own little canvas. */
const icon = (name, palette = name) => {
  icons ??= new Map();
  const key = `${name}|${palette}`;
  if (!icons.has(key)) {
    const rows = ICONS[name];
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    grid(c.getContext('2d'), rows, PALETTES[palette]);
    icons.set(key, c);
  }
  return icons.get(key);
};

/** Hearts, coins, gems, timer (§9.2). Screen space. */
export const drawHud = (r, { hearts, coins, coinTotal, gems, gemTotal, time, showTimer }) => {
  const y = 5;
  let x = 5;
  for (let i = 0; i < MAX_HEARTS; i++) {
    r.image(icon('heart', i < hearts ? 'heart' : 'heartEmpty'), x, y);
    x += 10;
  }
  x += 5;
  r.image(icon('coin'), x, y);
  const coinText = `${coins}/${coinTotal}`;
  label(r, coinText, x + 11, y, { align: 'left' });
  x += 11 + textWidth(coinText) + 8;
  for (let i = 0; i < gemTotal; i++) {
    r.image(icon('gem', gems[i] ? 'gem' : 'gemEmpty'), x, y);
    x += 11;
  }
  if (showTimer) {
    const text = formatTime(time);
    label(r, text, VIEW_W - 5, y, { align: 'right' });
    r.image(icon('clock'), VIEW_W - 5 - textWidth(text) - 10, y);
  }
};

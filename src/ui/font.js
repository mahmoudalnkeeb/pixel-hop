// "Hop Sans": a proportional pixel font with a dark outline and a soft drop shadow (Appendix C.5).
// Glyphs are 9 rows (caps on rows 0-6, descenders on 7-8), painted once per colour into an atlas,
// so text stays crisp at 320×180 instead of the blurry, browser-dependent CSS font.

const OUTLINE = '#1b1426';
const SHADOW = 'rgba(20,10,30,0.45)';
const ROWS = 9;
const CELL_H = ROWS + 3; // outline above and below, plus the shadow row
const SPACING = 1;

// Rows top to bottom, separated by spaces; missing rows are blank. '#' is ink.
const GLYPHS = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '### .#. .#. .#. .#. .#. ###',
  J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.###. #...# #.... .###. ....# #...# .###.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# .#.#. .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  a: '..... ..... .###. ....# .#### #...# .####',
  b: '#.... #.... ####. #...# #...# #...# ####.',
  c: '.... .... .### #... #... #... .###',
  d: '....# ....# .#### #...# #...# #...# .####',
  e: '..... ..... .###. #...# ##### #.... .###.',
  f: '..## .#.. ###. .#.. .#.. .#.. .#..',
  g: '..... ..... .#### #...# #...# #...# .#### ....# .###.',
  h: '#.... #.... ####. #...# #...# #...# #...#',
  i: '# . # # # # #',
  j: '..# ... ..# ..# ..# ..# ..# #.# .#.',
  k: '#... #... #..# #.#. ##.. #.#. #..#',
  l: '#. #. #. #. #. #. .#',
  m: '..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#',
  n: '..... ..... ####. #...# #...# #...# #...#',
  o: '..... ..... .###. #...# #...# #...# .###.',
  p: '..... ..... ####. #...# #...# #...# ####. #.... #....',
  q: '..... ..... .#### #...# #...# #...# .#### ....# ....#',
  r: '.... .... #.## ##.. #... #... #...',
  s: '..... ..... .#### #.... .###. ....# ####.',
  t: '.#.. .#.. ###. .#.. .#.. .#.. ..##',
  u: '..... ..... #...# #...# #...# #...# .####',
  v: '..... ..... #...# #...# .#.#. .#.#. ..#..',
  w: '..... ..... #...# #.#.# #.#.# #.#.# .#.#.',
  x: '..... ..... #...# .#.#. ..#.. .#.#. #...#',
  y: '..... ..... #...# #...# #...# #...# .#### ....# .###.',
  z: '..... ..... ##### ...#. ..#.. .#... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.',
  1: '.#. ##. .#. .#. .#. .#. ###',
  2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '.###. #...# ....# ..##. ....# #...# .###.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.',
  7: '##### ....# ...#. ..#.. ..#.. ..#.. ..#..',
  8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ....# .###.',
  ' ': '... ... ... ... ... ... ...',
  '.': '. . . . . . #',
  ',': '.. .. .. .. .. .# .# #.',
  '!': '# # # # # . #',
  '?': '.###. #...# ....# ..##. ..#.. ..... ..#..',
  ':': '. . # . . # .',
  ';': '.. .. .# .. .. .# .# #.',
  '-': '.... .... .... #### .... .... ....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '(': '.# #. #. #. #. #. .#',
  ')': '#. .# .# .# .# .# #.',
  '<': '.... ...# ..#. .#.. ..#. ...# ....',
  '>': '.... #... .#.. ..#. .#.. #... ....',
  "'": '# # . . . . .',
  '"': '#.# #.# ... ... ... ... ...',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  '=': '.... .... #### .... #### .... ....',
  '_': '..... ..... ..... ..... ..... ..... #####',
  '*': '..... #.#.# .###. ##### .###. #.#.# .....',
};
const FALLBACK = '?';

const glyphs = new Map(
  Object.entries(GLYPHS).map(([ch, src]) => {
    const rows = src.split(' ');
    return [ch, { rows, w: rows[0].length }];
  }),
);
const glyph = (ch) => glyphs.get(ch) ?? glyphs.get(FALLBACK);

/** Width of `str` in font pixels at scale 1 (outline not included). */
export const textWidth = (str) => {
  let w = 0;
  for (const ch of str) w += glyph(ch).w + SPACING;
  return Math.max(0, w - SPACING);
};

// One atlas per colour (and shine), built on first use: shadow, outline, then fill, per glyph cell.
const atlases = new Map();
const lighten = (hex, amt) => {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d).join('') : hex.slice(1); // #abc → aabbcc
  const n = parseInt(digits, 16);
  const f = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const atlas = (color, shine) => {
  const key = `${color}|${shine}`;
  if (atlases.has(key)) return atlases.get(key);
  const cells = new Map();
  let width = 0;
  for (const [ch, g] of glyphs) {
    cells.set(ch, width);
    width += g.w + 2;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = CELL_H;
  const ctx = canvas.getContext('2d');
  const ink = (g, x, y) => g.rows[y]?.[x] === '#';
  for (const [ch, g] of glyphs) {
    const ox = cells.get(ch) + 1;
    const paint = (fill, dy, around) => {
      ctx.fillStyle = fill;
      for (let y = -1; y <= ROWS; y++) {
        for (let x = -1; x <= g.w; x++) {
          let on = ink(g, x, y);
          if (around) for (let k = 0; k < 9 && !on; k++) on = ink(g, x + (k % 3) - 1, y + Math.floor(k / 3) - 1);
          if (on) ctx.fillRect(ox + x, 1 + y + dy, 1, 1);
        }
      }
    };
    paint(SHADOW, 1, true);
    paint(OUTLINE, 0, true);
    paint(color, 0, false);
    if (shine) {
      // Large titles: the top two rows of every stroke catch the light.
      ctx.fillStyle = lighten(color, 0.45);
      for (let y = 0; y < 2; y++) for (let x = 0; x < g.w; x++) if (ink(g, x, y) || (y === 1 && ink(g, x, 0))) ctx.fillRect(ox + x, 1 + y, 1, 1);
    }
  }
  const out = { canvas, cells };
  atlases.set(key, out);
  return out;
};

/**
 * Draw `str` with its top-left (or top-centre / top-right, per `align`) at x, y.
 * `scale` multiplies the pixels; `wave` (seconds) bobs each letter, for titles.
 */
export const drawText = (r, str, x, y, { color = '#fff', align = 'left', scale = 1, shine = false, wave } = {}) => {
  const a = atlas(color, shine);
  const w = textWidth(str) * scale;
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  let i = 0;
  for (const ch of str) {
    const g = glyph(ch);
    const sx = a.cells.get(glyphs.has(ch) ? ch : FALLBACK);
    const bob = wave === undefined ? 0 : Math.round(Math.sin(wave * 4 - i * 0.7) * scale);
    if (ch !== ' ') {
      r.image(a.canvas, cx - scale, Math.round(y) - scale + bob, { sx, sy: 0, sw: g.w + 2, sh: CELL_H, w: (g.w + 2) * scale, h: CELL_H * scale });
    }
    cx += (g.w + SPACING) * scale;
    i++;
  }
};

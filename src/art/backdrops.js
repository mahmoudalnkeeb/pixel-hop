import { MAX_VIEW_H, MAX_VIEW_W } from '../config.js';
import { canvas, ellipse, hash2, px } from './paint.js';

// Parallax backdrops for each world (§7): a screen-locked sky plus layers painted once into
// wrap-around canvases. Painted lazily on first draw so headless tests never touch the DOM.

export const LAYER_W = 384; // wider than the view so the repeat is harder to spot
export const PAD = 140; // rows painted above the view's window, revealed as the camera climbs
const H = MAX_VIEW_H + PAD; // tall enough for the tallest view

const rgb = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

/** Blend two #rrggbb colours; t = 0 gives `a`, 1 gives `b`. */
export const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Vertical gradient through `stops`, ordered-dithered between bands for a pixel-art look. */
const gradient = (ctx, w, h, stops) => {
  const bands = stops.length - 1;
  // Each band is quantised into 4 steps; pixels dither between neighbouring steps.
  const steps = stops.slice(0, -1).map((c, i) => [0, 1, 2, 3, 4].map((s) => mix(c, stops[i + 1], s / 4)));
  for (let y = 0; y < h; y++) {
    const t = (y / (h - 1)) * bands;
    const i = Math.min(bands - 1, Math.floor(t));
    const step = (t - i) * 4;
    const lo = Math.floor(step);
    for (let x = 0; x < w; x++) {
      const s = step - lo > BAYER[(y % 4) * 4 + (x % 4)] ? lo + 1 : lo;
      ctx.fillStyle = steps[i][Math.min(4, s)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
};

/** Glow: concentric discs fading out, for suns, moons and crystals. */
const glow = (ctx, x, y, radius, color, alpha = 0.12, rings = 5) => {
  ctx.fillStyle = color;
  for (let i = rings; i >= 1; i--) {
    ctx.globalAlpha = alpha;
    ellipse(ctx, x, y, (radius * i) / rings, (radius * i) / rings, color);
  }
  ctx.globalAlpha = 1;
};

/** Seamless 1-D noise across LAYER_W: sines with whole-number periods. `sharp` makes pointed peaks. */
const wave = (x, seed, parts, sharp = false) => {
  let y = 0;
  for (const [k, amp] of parts) {
    const s = Math.sin((x / LAYER_W) * Math.PI * 2 * k + hash2(seed, k) * 6.283);
    y += sharp ? (1 - Math.abs(s)) * amp * 2 - amp : s * amp;
  }
  return y;
};

/**
 * A silhouette filled down to the bottom of the canvas. `y` is the mean top edge inside the
 * 180 px window. Returns the top edge per column so props can stand on it.
 */
const ridge = (ctx, { y, parts, seed, color, rim, cap, capDepth = 0, sharp = false }) => {
  const tops = new Array(LAYER_W);
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(PAD + y - wave(x, seed, parts, sharp));
    tops[x] = top;
    px(ctx, x, top, 1, H - top, color);
    if (cap && top < PAD + y - capDepth) px(ctx, x, top, 1, Math.max(1, PAD + y - capDepth - top), cap);
    if (rim) px(ctx, x, top, 1, 1, rim);
  }
  return tops;
};

/** Hanging silhouette from the top of the canvas (cave ceilings, canopies). */
const ceiling = (ctx, { y, parts, seed, color, rim, sharp = false }) => {
  for (let x = 0; x < LAYER_W; x++) {
    const bottom = Math.round(PAD + y + wave(x, seed, parts, sharp));
    px(ctx, x, 0, 1, bottom, color);
    if (rim) px(ctx, x, bottom - 1, 1, 1, rim);
  }
};

/** Call `draw(x)` at x and its wrapped copies so features crossing the seam stay whole. */
const wrap = (x, draw) => {
  draw(x);
  draw(x - LAYER_W);
  draw(x + LAYER_W);
};

/** `n` positions spread along the layer with jitter, deterministic per seed. */
const spots = (n, seed) => Array.from({ length: n }, (_, i) => Math.round(((i + hash2(seed, i) * 0.7) / n) * LAYER_W));

const pine = (ctx, x, base, h, color, light) => {
  for (let row = 0; row < h; row++) {
    const half = Math.round(((row % Math.ceil(h / 3)) + row / 3) * 0.55) + 1;
    px(ctx, x - half, base - h + row, half * 2 + 1, 1, color);
    if (light && row % Math.ceil(h / 3) === 0) px(ctx, x - half + 1, base - h + row, 1, 1, light);
  }
  px(ctx, x, base - 1, 1, 3, color);
};

const roundTree = (ctx, x, base, r, color, light) => {
  px(ctx, x - 1, base - r - 2, 2, r + 3, color);
  ellipse(ctx, x, base - r * 1.6, r, r * 0.9, color);
  ellipse(ctx, x - r * 0.6, base - r * 1.2, r * 0.7, r * 0.6, color);
  ellipse(ctx, x + r * 0.6, base - r * 1.25, r * 0.7, r * 0.6, color);
  if (light) ellipse(ctx, x - r * 0.3, base - r * 2.05, r * 0.45, r * 0.3, light);
};

/** Puffy cloud: overlapping bumps on a flat bottom (`y`), shaded underneath and lit on top. */
const cloud = (ctx, x, y, w, body, shadow, light) => {
  const bumps = 3 + Math.floor(w / 24);
  const bottom = Math.round(y);
  const shape = Array.from({ length: bumps }, (_, i) => {
    const r = w * (0.14 + 0.12 * Math.sin((i / (bumps - 1 || 1)) * Math.PI));
    return { x: x - w / 2 + ((i + 0.5) / bumps) * w, r, ry: r * 0.8 };
  });
  for (const b of shape) ellipse(ctx, b.x, bottom - b.ry * 0.6, b.r, b.ry, shadow, bottom);
  for (const b of shape) ellipse(ctx, b.x, bottom - b.ry * 0.6 - 2, b.r, b.ry, body, bottom - 3);
  for (const b of shape) ellipse(ctx, b.x - b.r * 0.25, bottom - b.ry * 1.15, b.r * 0.45, b.ry * 0.3, light);
};

/** Floating island: grassy top, rocky underside tapering to a jagged point. */
const island = (ctx, x, y, w, rock, dark, top) => {
  const half = w / 2;
  for (let dx = -half; dx <= half; dx++) {
    const t = dx / half;
    const depth = Math.round((1 - t * t) * w * 0.45 + hash2(dx, y) * 3);
    px(ctx, Math.round(x + dx), y, 1, depth, rock);
    px(ctx, Math.round(x + dx), y + depth - 2, 1, 2, dark);
  }
  px(ctx, Math.round(x - half), y - 1, Math.round(w) + 1, 3, top);
};

/** Translucent diagonal light beam. */
const shaft = (ctx, x, w, slant, color, alpha) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + w, 0);
  ctx.lineTo(x + w + slant, H);
  ctx.lineTo(x + slant, H);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const crystal = (ctx, x, base, h, color, light) => {
  for (let row = 0; row < h; row++) {
    const half = Math.max(0, Math.round((row / h) * 2.5));
    px(ctx, x - half, base - h + row, half * 2 + 1, 1, color);
  }
  px(ctx, x, base - h + 1, 1, Math.round(h * 0.6), light);
};

const layer = (paint, f, extra = {}) => ({ canvas: canvas(LAYER_W, H, paint), f, ...extra });
const sky = (paint) => canvas(MAX_VIEW_W, MAX_VIEW_H, paint); // screen-locked; painted for the largest view

// World painters. Each returns { sky, layers (far to near), ambience, lightning? }.
const WORLD_ART = {
  // Green Hills: bright morning, far blue mountains, rolling hills with trees.
  1: () => {
    const horizon = '#d4f1ff';
    return {
      sky: sky((ctx) => {
        gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#3d9be9', '#6ec6ff', '#a8defa', horizon]);
        glow(ctx, 256, 34, 40, '#fff6c8', 0.1);
        ellipse(ctx, 256, 34, 11, 11, '#fff8d6');
      }),
      layers: [
        layer((ctx) => {
          for (const [i, x] of spots(5, 11).entries()) {
            wrap(x, (xx) => cloud(ctx, xx, PAD + 40 + hash2(i, 3) * 36, 40 + hash2(i, 5) * 36, '#f4fbff', '#bcd9ee', '#ffffff'));
          }
        }, 0.05, { drift: 3 }),
        layer((ctx) => {
          ridge(ctx, { y: 84, parts: [[2, 10], [5, 9], [9, 4]], seed: 1, color: '#8ec3e6', cap: '#eef8ff', capDepth: 14, sharp: true });
        }, 0.12),
        layer((ctx) => {
          const tops = ridge(ctx, { y: 100, parts: [[2, 10], [4, 6], [7, 3]], seed: 2, color: '#86cfa4', rim: '#a6e0bc' });
          for (const x of spots(9, 21)) wrap(x, (xx) => roundTree(ctx, xx, tops[(x + LAYER_W) % LAYER_W] + 2, 6, '#6fbf8f', '#8fd8a8'));
        }, 0.3),
        layer((ctx) => {
          const tops = ridge(ctx, { y: 114, parts: [[3, 8], [6, 4], [11, 2]], seed: 3, color: '#5fb36a', rim: '#82cc7c' });
          for (const x of spots(7, 31)) wrap(x, (xx) => pine(ctx, xx, tops[x] + 2, 18 + Math.round(hash2(x, 1) * 8), '#3f8f55', '#5fae68'));
          for (const x of spots(30, 41)) wrap(x, (xx) => px(ctx, xx, tops[x] + 3, 1, 1, hash2(x, 2) > 0.5 ? '#fff3a0' : '#ffb3c6'));
        }, 0.5),
      ],
      ambience: 'pollen',
    };
  },

  // Bramble Woods: misty forest, light shafts through the canopy, fireflies.
  2: () => ({
    sky: sky((ctx) => gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#10251f', '#1f3d33', '#3d6650', '#5f8a68'])),
    layers: [
      layer((ctx) => {
        for (const x of spots(4, 5)) wrap(x, (xx) => shaft(ctx, xx, 14 + hash2(x, 2) * 14, 60, '#e8f5c0', 0.08));
        for (const x of spots(14, 6)) wrap(x, (xx) => px(ctx, xx, 0, 4 + Math.round(hash2(x, 1) * 4), H, '#355a47'));
        ceiling(ctx, { y: 18, parts: [[3, 8], [7, 5], [13, 3]], seed: 7, color: '#2c4c3c' });
      }, 0.12),
      layer((ctx) => {
        for (const x of spots(9, 8)) wrap(x, (xx) => px(ctx, xx, 0, 7 + Math.round(hash2(x, 1) * 5), H, '#24402f'));
        ceiling(ctx, { y: 8, parts: [[2, 7], [5, 6], [11, 3]], seed: 9, color: '#1d3627', rim: '#2f5a3c' });
        ridge(ctx, { y: 104, parts: [[3, 5], [8, 3]], seed: 10, color: '#24402f' });
      }, 0.3),
      layer((ctx) => {
        const tops = ridge(ctx, { y: 116, parts: [[4, 6], [9, 4], [17, 2]], seed: 12, color: '#142a1e', rim: '#24452f' });
        // Thorny bramble tufts.
        for (const x of spots(40, 13)) wrap(x, (xx) => px(ctx, xx, tops[x] - 3 - Math.round(hash2(x, 3) * 4), 1, 4, '#142a1e'));
      }, 0.5),
    ],
    ambience: 'firefly',
  }),

  // Crystal Caves: stalactites and glowing crystals in the dark.
  3: () => ({
    sky: sky((ctx) => gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#07070f', '#110f22', '#1c1838', '#141228'])),
    layers: [
      layer((ctx) => {
        ceiling(ctx, { y: 22, parts: [[5, 10], [11, 8], [23, 4]], seed: 3, color: '#1b1a33', sharp: true });
        ridge(ctx, { y: 100, parts: [[4, 10], [9, 6], [19, 3]], seed: 4, color: '#1b1a33', sharp: true });
      }, 0.1),
      layer((ctx) => {
        ceiling(ctx, { y: 6, parts: [[4, 9], [9, 7], [17, 5]], seed: 5, color: '#25233f', rim: '#3a3760', sharp: true });
        const tops = ridge(ctx, { y: 114, parts: [[3, 8], [7, 6], [15, 3]], seed: 6, color: '#25233f', rim: '#3a3760' });
        for (const x of spots(8, 12)) {
          // Muted, so they never read as the crystal lights Hop can touch.
          const hue = hash2(x, 4) > 0.5 ? ['#3d6a80', '#6fa2b4'] : ['#54477f', '#8676b2'];
          wrap(x, (xx) => {
            glow(ctx, xx, tops[x] - 5, 10, hue[0], 0.04, 2);
            crystal(ctx, xx, tops[x] + 1, 8 + Math.round(hash2(x, 5) * 7), hue[0], hue[1]);
            crystal(ctx, xx + 4, tops[x] + 1, 5, hue[0], hue[1]);
          });
        }
      }, 0.3),
    ],
    ambience: 'mote',
  }),

  // Cloud Ruins: warm sunset, floating ruins, a sea of clouds.
  4: () => {
    const horizon = '#ffe7c2';
    return {
      sky: sky((ctx) => {
        gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#ff9f8a', '#ffbf9a', '#ffd9a8', horizon]);
        glow(ctx, 80, 72, 46, '#fff1c0', 0.12);
        ellipse(ctx, 80, 72, 18, 18, '#fff4cf');
        for (const y of [70, 76, 82]) px(ctx, 62, y, 36, 1, '#ffd9a8');
      }),
      layers: [
        layer((ctx) => {
          for (const [i, x] of spots(4, 15).entries()) {
            wrap(x, (xx) => cloud(ctx, xx, PAD + 50 + hash2(i, 7) * 40, 56 + hash2(i, 9) * 40, '#ffe6d6', '#efb3ac', '#fff6ee'));
          }
        }, 0.06, { drift: 2 }),
        layer((ctx) => {
          // Floating islands with ruined pillars.
          for (const [i, x] of spots(3, 17).entries()) {
            const y = PAD + 52 + Math.round(hash2(i, 2) * 30);
            const w = 34 + Math.round(hash2(i, 4) * 22);
            wrap(x, (xx) => {
              // Broken pillars of different heights, then the island in front of their bases.
              for (const [k, dx] of [-w / 3, -w / 12, w / 4].entries()) {
                const h = 10 + Math.round(hash2(i, k) * 16);
                px(ctx, Math.round(xx + dx), y - h, 5, h, '#e3c9e2');
                px(ctx, Math.round(xx + dx), y - h, 1, h, '#f3e3f2');
                px(ctx, Math.round(xx + dx) - 1, y - h, 7, 2, '#f3e3f2');
              }
              island(ctx, xx, y, w, '#c9a5c8', '#a986aa', '#e9d3ec');
            });
          }
        }, 0.18),
        layer((ctx) => {
          // A sea of clouds: rounded bumps with a lit rim.
          for (const x of spots(12, 20)) wrap(x, (xx) => ellipse(ctx, xx, PAD + 114, 24 + hash2(x, 1) * 10, 12, '#ffffff'));
          for (const x of spots(12, 20)) wrap(x, (xx) => ellipse(ctx, xx, PAD + 116, 24 + hash2(x, 1) * 10, 12, '#fbe3ec'));
          px(ctx, 0, PAD + 118, LAYER_W, H - PAD - 118, '#fbe3ec');
        }, 0.4),
      ],
      ambience: 'petal',
    };
  },

  // Storm Keep: night storm, King Gloop's castle on the horizon, rain and lightning.
  5: () => ({
    sky: sky((ctx) => {
      gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#0c0816', '#1a1230', '#2e2148', '#3e2c58']);
      for (let i = 0; i < 40; i++) px(ctx, Math.floor(hash2(i, 1) * MAX_VIEW_W), Math.floor(hash2(1, i) * 80), 1, 1, hash2(i, 2) > 0.8 ? '#ffffff' : '#8a7fb0');
    }),
    layers: [
      layer((ctx) => {
        ceiling(ctx, { y: 4, parts: [[3, 4], [7, 2]], seed: 21, color: '#1c142c' });
        for (const [i, x] of spots(6, 24).entries()) {
          wrap(x, (xx) => cloud(ctx, xx, PAD + 18 + hash2(i, 2) * 22, 70 + hash2(i, 3) * 50, '#2b2043', '#1c142c', '#3f3060'));
        }
      }, 0.05, { drift: 6 }),
      layer((ctx) => {
        const tops = ridge(ctx, { y: 92, parts: [[3, 14], [7, 6], [15, 3]], seed: 22, color: '#2a2040', sharp: true });
        // King Gloop's keep, small and far away on the highest peak, with a few lit windows.
        const x = tops.indexOf(Math.min(...tops));
        const base = tops[x] + 3;
        const keep = '#211833';
        px(ctx, x - 14, base, 28, H - base, '#2a2040'); // plateau, so the walls never overhang the peak
        px(ctx, x - 10, base - 16, 20, 16, keep);
        for (const [dx, h] of [[-13, 26], [7, 30], [-3, 38]]) {
          px(ctx, x + dx, base - h, 6, h, keep);
          for (let i = 0; i < 6; i += 2) px(ctx, x + dx + i, base - h - 2, 1, 2, keep);
          px(ctx, x + dx + 2, base - h + 5, 2, 2, '#d9a84a');
        }
        px(ctx, x - 1, base - 34, 2, 3, '#ffcf5a'); // the throne room
        for (const dx of [-7, 3]) px(ctx, x + dx, base - 9, 1, 2, '#b98a3c');
      }, 0.12),
      layer((ctx) => {
        ridge(ctx, { y: 114, parts: [[4, 10], [9, 6], [19, 3]], seed: 23, color: '#160f22', rim: '#2a1f3d', sharp: true });
      }, 0.35),
    ],
    ambience: 'rain',
    lightning: true,
  }),

  // Throne of Gloop (level 10): inside the keep. Arched windows onto the storm, torch-lit pillars.
  throne: () => ({
    sky: sky((ctx) => gradient(ctx, MAX_VIEW_W, MAX_VIEW_H, ['#120d1c', '#1a1428', '#221a33'])),
    layers: [
      layer((ctx) => {
        px(ctx, 0, 0, LAYER_W, H, '#2a2238');
        for (let y = 0; y < H; y += 8) {
          px(ctx, 0, y, LAYER_W, 1, '#221b2e');
          for (let x = (y / 8) % 2 ? 0 : 8; x < LAYER_W; x += 16) px(ctx, x, y, 1, 8, '#221b2e');
        }
        for (let x = 64; x < LAYER_W; x += 128) {
          const top = PAD + 34;
          const w = 28;
          const h = 56;
          px(ctx, x - w / 2 - 3, top - 3, w + 6, h + 6, '#3a3050');
          ellipse(ctx, x, top, w / 2 + 3, 14, '#3a3050');
          px(ctx, x - w / 2, top, w, h, '#3e2c58');
          ellipse(ctx, x, top, w / 2, 11, '#3e2c58');
          for (let i = 0; i < 12; i++) px(ctx, x - w / 2 + Math.floor(hash2(i, x) * w), top - 6 + Math.floor(hash2(x, i) * (h - 4)), 1, 3, '#6a5a90');
          px(ctx, x - 1, top - 10, 2, h + 10, '#2a2238'); // mullion
          px(ctx, x - w / 2, top + h / 2, w, 2, '#2a2238');
        }
      }, 0.15),
      layer((ctx) => {
        for (let x = 0; x < LAYER_W; x += 96) {
          px(ctx, x, 0, 18, H, '#352b48');
          px(ctx, x, 0, 3, H, '#463a5e');
          px(ctx, x + 15, 0, 3, H, '#2a2238');
          px(ctx, x - 3, PAD + 150, 24, 6, '#463a5e'); // base
          // Torch: bracket, flame and its glow.
          glow(ctx, x + 9, PAD + 62, 26, '#ffa040', 0.06, 4);
          px(ctx, x + 6, PAD + 66, 6, 2, '#1c1626');
          px(ctx, x + 8, PAD + 64, 2, 6, '#1c1626');
          px(ctx, x + 7, PAD + 58, 4, 5, '#ff8a2a');
          px(ctx, x + 8, PAD + 56, 2, 4, '#ffd36a');
        }
      }, 0.35),
    ],
    ambience: 'ember',
    lightning: true,
  }),
};

let cached = { world: 0, art: null };

/** A world's (or a named level's) backdrop art, painted on first use. Only one is kept, to save memory on phones. */
export const backdrop = (world) => {
  if (cached.world !== world) cached = { world, art: (WORLD_ART[world] ?? WORLD_ART[1])() };
  return cached.art;
};

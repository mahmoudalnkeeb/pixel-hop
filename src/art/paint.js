// Helpers to paint pixel art into offscreen canvases that become SpriteSheets.
// Sheets are built lazily on first draw so headless tests never touch the DOM.
import { SpriteSheet } from '../../vendor/h3-engine.min.js';

/** A canvas of the given size, painted by `draw(ctx)`. */
export const canvas = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
};

/** Paint a char grid: each char maps to a colour in `palette`; '.' is transparent. */
export const grid = (ctx, rows, palette, ox = 0, oy = 0) => {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
};

export const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Filled pixel ellipse (no anti-aliasing), optionally cut off below `maxY`. */
export const ellipse = (ctx, cx, cy, rx, ry, color, maxY = Infinity) => {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const row = Math.round(cy + y);
    if (row > maxY) break;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    ctx.fillRect(Math.round(cx - half), row, half * 2, 1);
  }
};

/** Deterministic 0..1 noise for tile variation. */
export const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Paint `count` frames of w×h into a padded sheet: each frame gets a 1 px border repeating its own
 * edge pixels. At fractional scales (phones) the browser can sample just past a frame's edge;
 * without the border it picks up the neighbouring frame, which shows as thin lines between tiles.
 * `paint(ctx, ox, i)` draws frame i with its left edge at ox and its top at y = 0.
 */
export const paddedSheet = (count, w, h, paint, { originX = 0, originY = 0 } = {}) => {
  const step = w + 2;
  const image = canvas(count * step, h + 2, (ctx) => {
    ctx.translate(0, 1);
    for (let i = 0; i < count; i++) paint(ctx, i * step + 1, i);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < count; i++) {
      const x = i * step + 1;
      ctx.drawImage(ctx.canvas, x, 1, 1, h, x - 1, 1, 1, h);
      ctx.drawImage(ctx.canvas, x + w - 1, 1, 1, h, x + w, 1, 1, h);
      ctx.drawImage(ctx.canvas, x - 1, 1, w + 2, 1, x - 1, 0, w + 2, 1);
      ctx.drawImage(ctx.canvas, x - 1, h, w + 2, 1, x - 1, h + 1, w + 2, 1);
    }
  });
  return new SpriteSheet(image, { frameW: w, frameH: h, margin: 1, spacing: 2, originX, originY });
};

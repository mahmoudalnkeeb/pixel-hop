// Helpers to paint pixel art into offscreen canvases that become SpriteSheets.
// Sheets are built lazily on first draw so headless tests never touch the DOM.

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

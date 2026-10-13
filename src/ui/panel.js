// Shared UI pieces (§9.2): a rounded, outlined panel and a selection pointer, so every menu
// looks like it belongs to the same game.

const OUTLINE = '#0e0b1c';

/**
 * A panel with 1 px rounded corners, a dark outline and a lit top edge. The pieces never overlap,
 * so a translucent fill stays even.
 */
export const panel = (r, x, y, w, h, { fill = 'rgba(24,20,48,0.94)', edge = 'rgba(255,255,255,0.14)', outline = OUTLINE } = {}) => {
  x = Math.round(x);
  y = Math.round(y);
  r.rect(x + 2, y, w - 4, 1, outline);
  r.rect(x + 2, y + h - 1, w - 4, 1, outline);
  r.rect(x, y + 2, 1, h - 4, outline);
  r.rect(x + w - 1, y + 2, 1, h - 4, outline);
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) r.rect(cx, cy, 1, 1, outline);
  r.rect(x + 2, y + 1, w - 4, 1, edge);
  r.rect(x + 1, y + 2, w - 2, h - 4, fill);
  r.rect(x + 2, y + h - 2, w - 4, 1, fill);
};

/** A highlight bar behind the selected row. */
export const selection = (r, x, y, w, h) => {
  r.rect(Math.round(x), Math.round(y), w, h, 'rgba(255,210,63,0.16)');
  r.rect(Math.round(x), Math.round(y), 2, h, '#ffd23f');
};

/** A small right-pointing arrow that nudges back and forth, left of the selected item. */
export const pointer = (r, x, y, color = '#ffd23f') => {
  const nudge = Math.round(Math.sin(performance.now() / 120));
  const px = Math.round(x) + nudge;
  const py = Math.round(y);
  r.rect(px, py, 1, 7, OUTLINE);
  r.rect(px + 1, py, 1, 7, color);
  r.rect(px + 2, py + 1, 1, 5, color);
  r.rect(px + 3, py + 2, 1, 3, color);
  r.rect(px + 4, py + 3, 1, 1, color);
  r.rect(px + 2, py + 6, 2, 1, OUTLINE);
};

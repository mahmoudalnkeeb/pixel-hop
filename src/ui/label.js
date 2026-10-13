import { drawText } from './font.js';

/**
 * Draw outlined pixel-font text so it reads over any background (Appendix C.5).
 * `size` keeps the old CSS-font sizes: 8 is the base font, 16 and 24 draw it at 2× and 3× with a highlight.
 * `wave` (seconds) makes the letters bob, for titles.
 */
export const label = (r, str, x, y, { size = 8, color = '#fff', align = 'center', wave } = {}) => {
  const scale = Math.max(1, Math.round(size / 8));
  drawText(r, String(str), x, y, { color, align, scale, shine: scale > 1, wave });
};

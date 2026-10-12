/** Draw text with a 1px drop shadow so it reads over any background (Appendix C.5). Fallback until the bitmap font exists. */
export const label = (r, str, x, y, { size = 8, color = '#fff', align = 'center' } = {}) => {
  const font = `bold ${size}px monospace`;
  r.text(str, x + 1, y + 1, { font, color: 'rgba(0,0,0,0.5)', align });
  r.text(str, x, y, { font, color, align });
};

import { MAX_HEARTS, VIEW_W } from '../config.js';
import { drawHeart } from '../entities/pickups.js';
import { label } from './label.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;

/** Hearts, coins, gems, timer (§9.2). Screen space. */
export const drawHud = (r, { hearts, coins, coinTotal, gems, gemTotal, time, showTimer }) => {
  for (let i = 0; i < MAX_HEARTS; i++) {
    drawHeart(r, 5 + i * 12, 5, i < hearts ? '#ff5e7a' : 'rgba(0,0,0,0.35)');
  }
  // Coins
  r.rect(48, 5, 6, 9, '#ffd23f');
  r.rect(49, 6, 1, 7, '#fff6b0');
  label(r, `${coins}/${coinTotal}`, 58, 5, { align: 'left' });
  // Gems: 3 slots
  for (let i = 0; i < gemTotal; i++) {
    const cx = 108 + i * 10;
    const color = gems[i] ? '#ffb627' : 'rgba(0,0,0,0.35)';
    r.poly([cx, 4, cx + 4, 9, cx, 14, cx - 4, 9], color);
  }
  if (showTimer) label(r, formatTime(time), VIEW_W - 5, 5, { align: 'right' });
};

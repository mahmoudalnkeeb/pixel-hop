import { MAX_HEARTS, VIEW_W } from '../config.js';
import { characters, PICKUP_FRAMES } from '../art/characters.js';
import { textWidth } from './font.js';
import { label } from './label.js';
import { panel } from './panel.js';

const EMPTY = { alpha: 0.3 }; // a slot not filled yet
const PILL = { fill: 'rgba(10,8,24,0.38)', edge: 'rgba(255,255,255,0.08)', outline: 'rgba(10,8,24,0.5)' };

const pad2 = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;

/** Hearts, coins, gems, timer (§9.2). Screen space. */
export const drawHud = (r, { hearts, coins, coinTotal, gems, gemTotal, time, showTimer }) => {
  // Soft backing pills keep the HUD readable over bright skies without boxing it in.
  panel(r, 2, 1, 150, 20, PILL);
  const sheet = characters();
  // Sprites are anchored bottom-centre; y = 17 puts their visible tops about 4 px down.
  for (let i = 0; i < MAX_HEARTS; i++) r.sprite(sheet.frame(PICKUP_FRAMES.heart), 11 + i * 14, 17, i < hearts ? undefined : EMPTY);
  r.sprite(sheet.frame(PICKUP_FRAMES.coin), 56, 17);
  label(r, `${coins}/${coinTotal}`, 64, 5, { align: 'left' });
  for (let i = 0; i < gemTotal; i++) r.sprite(sheet.frame(PICKUP_FRAMES.gem), 114 + i * 13, 17, gems[i] ? undefined : EMPTY);
  if (showTimer) {
    const text = formatTime(time);
    panel(r, VIEW_W - textWidth(text) - 12, 1, textWidth(text) + 10, 15, PILL);
    label(r, text, VIEW_W - 6, 4, { align: 'right' });
  }
};

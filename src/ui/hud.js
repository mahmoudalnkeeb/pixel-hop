import { MAX_HEARTS, VIEW_W } from '../config.js';
import { characters, PICKUP_FRAMES } from '../art/characters.js';
import { label } from './label.js';

const EMPTY = { alpha: 0.3 }; // a slot not filled yet

const pad2 = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;

/** Hearts, coins, gems, timer (§9.2). Screen space. */
export const drawHud = (r, { hearts, coins, coinTotal, gems, gemTotal, time, showTimer }) => {
  const sheet = characters();
  // Sprites are anchored bottom-centre; y = 17 puts their visible tops about 4 px down.
  for (let i = 0; i < MAX_HEARTS; i++) r.sprite(sheet.frame(PICKUP_FRAMES.heart), 11 + i * 14, 17, i < hearts ? undefined : EMPTY);
  r.sprite(sheet.frame(PICKUP_FRAMES.coin), 56, 17);
  label(r, `${coins}/${coinTotal}`, 64, 5, { align: 'left' });
  for (let i = 0; i < gemTotal; i++) r.sprite(sheet.frame(PICKUP_FRAMES.gem), 114 + i * 13, 17, gems[i] ? undefined : EMPTY);
  if (showTimer) label(r, formatTime(time), VIEW_W - 5, 5, { align: 'right' });
};

import { MAX_HEARTS, VIEW_W } from '../config.js';
import { characters, PICKUP_FRAMES } from '../art/characters.js';
import { textWidth } from './font.js';
import { label } from './label.js';
import { panel } from './panel.js';

const EMPTY = { alpha: 0.3 }; // a slot not filled yet
// The backing is a soft, borderless tint: enough to read the HUD over bright skies, without a box.
const TINT = 'rgba(10,8,24,0.32)';
const PILL = { fill: TINT, edge: 'rgba(255,255,255,0.06)', outline: TINT };
const HEART_STEP = 14;
const GEM_STEP = 13;

const pad2 = (n) => String(n).padStart(2, '0');
export const formatTime = (t) => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;

/** Hearts, coins, gems, timer (§9.2). Screen space. */
export const drawHud = (r, { hearts, coins, coinTotal, gems, gemTotal, time, showTimer }) => {
  const sheet = characters();
  const coinText = `${coins}/${coinTotal}`;
  // Lay out left to right, then size the backing to fit (levels without gems get a shorter bar).
  const coinX = 6 + MAX_HEARTS * HEART_STEP + 8; // coin icon centre
  const textX = coinX + 8;
  const gemX = textX + textWidth(coinText) + 12; // first gem centre
  const right = gemTotal > 0 ? gemX + (gemTotal - 1) * GEM_STEP + 7 : textX + textWidth(coinText) + 4;
  panel(r, 2, 2, right, 17, PILL);
  // Sprites are anchored bottom-centre; y = 17 puts their visible tops about 4 px down.
  for (let i = 0; i < MAX_HEARTS; i++) r.sprite(sheet.frame(PICKUP_FRAMES.heart), 11 + i * HEART_STEP, 17, i < hearts ? undefined : EMPTY);
  r.sprite(sheet.frame(PICKUP_FRAMES.coin), coinX, 17);
  label(r, coinText, textX, 7, { align: 'left' });
  for (let i = 0; i < gemTotal; i++) r.sprite(sheet.frame(PICKUP_FRAMES.gem), gemX + i * GEM_STEP, 17, gems[i] ? undefined : EMPTY);
  if (showTimer) {
    const text = formatTime(time);
    const w = textWidth(text) + 10;
    panel(r, VIEW_W - w - 2, 2, w, 17, PILL);
    label(r, text, VIEW_W - 7, 7, { align: 'right' });
  }
};

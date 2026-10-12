// Placeholder SFX (GDD §8.4): every sound is a synthesized voice from the prototype-tone table,
// played on the mixer's sfx or ui bus. Replace with authored samples in production.

const semis = (n) => 2 ** (n / 12);
const jitter = (pct) => 1 + (Math.random() * 2 - 1) * pct;

const RETRIGGER = 0.03; // same ID can't retrigger within 30 ms (§8.5)

// [freq, to, duration, type, volume, delay]
const TONES = {
  jump: [[300, 600, 0.1, 'square', 0.1]],
  land: [[160, 90, 0.06, 'triangle', 0.08]],
  wall_slide: [[1200, 1100, 0.05, 'sawtooth', 0.03]],
  wall_jump: [[350, 700, 0.09, 'square', 0.1]],
  coin: [[988, 1319, 0.08, 'square', 0.1]],
  gem: [[784, 1568, 0.35, 'triangle', 0.12], [1175, 2349, 0.35, 'triangle', 0.12, 0.12]],
  heart: [[523, 1047, 0.2, 'triangle', 0.12]],
  stomp: [[220, 80, 0.12, 'square', 0.15]],
  hurt: [[300, 120, 0.25, 'sawtooth', 0.15]],
  die: [[440, 80, 0.6, 'sawtooth', 0.15]],
  pit: [[600, 100, 0.4, 'triangle', 0.12]],
  checkpoint: [[523, undefined, 0.08, 'triangle', 0.12], [659, undefined, 0.08, 'triangle', 0.12, 0.08], [784, undefined, 0.08, 'triangle', 0.12, 0.16]],
  spring: [[200, 900, 0.18, 'square', 0.14]],
  platform: [[140, undefined, 0.04, 'square', 0.04]],
  hopper_hop: [[250, 500, 0.08, 'square', 0.06]],
  stomp_armor: [[600, 300, 0.08, 'square', 0.15]],
  ui_move: [[660, undefined, 0.03, 'square', 0.06]],
  ui_confirm: [[660, 990, 0.06, 'square', 0.08]],
  ui_back: [[990, 660, 0.06, 'square', 0.08]],
  pause: [[440, undefined, 0.05, 'triangle', 0.08]],
  // Boss (§8.4)
  boss_roar: [[120, 60, 1.2, 'sawtooth', 0.2], [126, 63, 1.2, 'square', 0.08]],
  boss_tell_hop: [[300, 150, 0.4, 'sine', 0.12]],
  boss_land: [[80, 40, 0.3, 'square', 0.2]],
  shockwave: [[150, undefined, 0.5, 'sawtooth', 0.06]],
  boss_dazed: [[1200, 1500, 0.1, 'triangle', 0.1], [1500, 1200, 0.1, 'triangle', 0.1, 0.1], [1200, 1500, 0.1, 'triangle', 0.1, 0.2]],
  boss_hit: [[160, 60, 0.25, 'square', 0.2], [220, 80, 0.12, 'square', 0.15]],
  boss_defeat: [[400, 40, 2.0, 'sawtooth', 0.2]],
};

const BUS = { ui_move: 'ui', ui_confirm: 'ui', ui_back: 'ui', pause: 'ui' };
const JITTER = { jump: 0.04, wall_jump: 0.04, spring: 0.03 };
const LIMIT = { coin: 4, stomp: 2, cannon: 3 }; // simultaneous voices (§8.5)
const DUCK = { gem: [0.5, 0.6], hurt: [0.3, 0.3], die: [0.6, 1] }; // [amount, seconds]

/** @type {import('./audio/Mixer.js').Mixer | null} */
let mixer = null;
const lastPlayed = new Map();
const playing = new Map();

/** Route all SFX through this mixer. Until called (e.g. headless tests), sfx() is silent. */
export const initSfx = (m) => {
  mixer = m;
};

/**
 * Play a sound by GDD ID.
 * @param {keyof typeof TONES} id
 * @param {{ semitones?: number, volume?: number }} [opts]
 */
export const sfx = (id, { semitones = 0, volume = 1 } = {}) => {
  const ctx = mixer?.ctx;
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(id) ?? -1) < RETRIGGER) return;
  const tones = TONES[id];
  const length = Math.max(...tones.map((t) => t[2] + (t[5] ?? 0)));
  if (LIMIT[id]) {
    const ends = (playing.get(id) ?? []).filter((end) => end > now);
    if (ends.length >= LIMIT[id]) return;
    ends.push(now + length);
    playing.set(id, ends);
  }
  lastPlayed.set(id, now);
  const rate = semis(semitones) * (JITTER[id] ? jitter(JITTER[id]) : 1);
  for (const [freq, to, duration, type, vol, delay = 0] of tones) {
    mixer.voice(BUS[id] ?? 'sfx', {
      freq: freq * rate,
      to: to === undefined ? undefined : to * rate,
      duration,
      type,
      volume: vol * volume,
      at: now + delay,
    });
  }
  if (DUCK[id]) mixer.duck(...DUCK[id]);
};

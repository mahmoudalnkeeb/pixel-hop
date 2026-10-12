// Placeholder sound: every SFX is an `audio.tone()` from the GDD §8.4 table, so there are no files to load.

const semis = (n) => 2 ** (n / 12);
const jitter = (pct) => 1 + (Math.random() * 2 - 1) * pct;

/** Same ID can't retrigger within 30 ms (§8.5). */
const RETRIGGER = 0.03;
const lastPlayed = new Map();

const TONES = {
  jump: [{ freq: 300, to: 600, duration: 0.1, type: 'square', volume: 0.1 }],
  land: [{ freq: 160, to: 90, duration: 0.06, type: 'triangle', volume: 0.08 }],
  wall_slide: [{ freq: 1200, to: 1100, duration: 0.05, type: 'sawtooth', volume: 0.03 }],
  wall_jump: [{ freq: 350, to: 700, duration: 0.09, type: 'square', volume: 0.1 }],
  coin: [{ freq: 988, to: 1319, duration: 0.08, type: 'square', volume: 0.1 }],
  gem: [
    { freq: 784, to: 1568, duration: 0.35, type: 'triangle', volume: 0.12 },
    { freq: 1175, to: 2349, duration: 0.35, type: 'triangle', volume: 0.12, delay: 0.12 },
  ],
  heart: [{ freq: 523, to: 1047, duration: 0.2, type: 'triangle', volume: 0.12 }],
  stomp: [{ freq: 220, to: 80, duration: 0.12, type: 'square', volume: 0.15 }],
  hurt: [{ freq: 300, to: 120, duration: 0.25, type: 'sawtooth', volume: 0.15 }],
  die: [{ freq: 440, to: 80, duration: 0.6, type: 'sawtooth', volume: 0.15 }],
  pit: [{ freq: 600, to: 100, duration: 0.4, type: 'triangle', volume: 0.12 }],
  checkpoint: [
    { freq: 523, duration: 0.08, type: 'triangle', volume: 0.12 },
    { freq: 659, duration: 0.08, type: 'triangle', volume: 0.12, delay: 0.08 },
    { freq: 784, duration: 0.08, type: 'triangle', volume: 0.12, delay: 0.16 },
  ],
  spring: [{ freq: 200, to: 900, duration: 0.18, type: 'square', volume: 0.14 }],
  platform: [{ freq: 140, duration: 0.04, type: 'square', volume: 0.04 }],
  ui_move: [{ freq: 660, duration: 0.03, type: 'square', volume: 0.06 }],
  ui_confirm: [{ freq: 660, to: 990, duration: 0.06, type: 'square', volume: 0.08 }],
  ui_back: [{ freq: 990, to: 660, duration: 0.06, type: 'square', volume: 0.08 }],
  pause: [{ freq: 440, duration: 0.05, type: 'triangle', volume: 0.08 }],
};

/** Pitch variation per ID (§8.4). */
const JITTER = { jump: 0.04, wall_jump: 0.04, spring: 0.03 };

/**
 * Play a sound by GDD ID.
 * @param {object} audio Engine `Audio`.
 * @param {keyof typeof TONES} id
 * @param {{ semitones?: number, volume?: number, timer?: object }} [opts] `timer` (scene.timer) is needed for multi-note sounds.
 */
export const sfx = (audio, id, { semitones = 0, volume = 1, timer } = {}) => {
  const now = performance.now() / 1000;
  if (now - (lastPlayed.get(id) ?? -1) < RETRIGGER) return;
  lastPlayed.set(id, now);
  const rate = semis(semitones) * (JITTER[id] ? jitter(JITTER[id]) : 1);
  for (const t of TONES[id]) {
    const play = () =>
      audio.tone({
        freq: t.freq * rate,
        to: t.to === undefined ? undefined : t.to * rate,
        duration: t.duration,
        type: t.type,
        volume: t.volume * volume,
      });
    if (t.delay && timer) timer.after(t.delay, play);
    else if (!t.delay) play();
  }
};

/** A rising run of notes for clearing a level (Appendix C.6). `timer` is `scene.timer`. */
export const fanfare = (timer, audio) => {
  [523, 659, 784, 1047].forEach((freq, i) => {
    timer.after(i * 0.12, () => audio.tone({ freq, duration: 0.15, type: 'triangle' }));
  });
};

// Chiptune score (GDD §8.3). Each bar is 16 sixteenth-note tokens:
// a note ("C4", "F#5", "Eb3") starts a note, "-" holds it, "." is a rest.
// Drum tracks use k (kick), s (snare), h (hat) and ".".
// Every track shares one 4-bar main-theme motif, re-keyed per world, so the soundtrack reads as one piece.

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const noteToMidi = (name) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note "${name}"`);
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
};
const midiToNote = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const shift = (note, semis) => midiToNote(noteToMidi(note) + semis);

/** Transpose every note in a list of bars. */
const tr = (bars, semis) => bars.map((bar) => bar.replace(/[A-G](#|b)?-?\d/g, (n) => shift(n, semis)));
/** Eighth-note bass bouncing between octaves, with the fifth on beat 4. */
const bounce = (root) => {
  const hi = shift(root, 12);
  const fifth = shift(root, 7);
  return `${root} . ${hi} . ${root} . ${hi} . ${root} . ${hi} . ${fifth} . ${hi} .`;
};
/** Tuba-style oom-pah: root, fifth below. */
const oomPah = (root) => {
  const low = shift(root, -5);
  return `${root} . ${low} . ${root} . ${low} . ${root} . ${low} . ${root} . ${low} .`;
};
/** 16th-note arpeggio over a triad. */
const arp = ([a, b, c]) => `${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b}`;
const hold = (note) => `${note} - - - - - - - - - - - - - - -`;
const rep = (bar, n) => Array(n).fill(bar);

// Main theme in G major (music_hills).
const THEME = [
  'G4 . B4 . D5 - - . B4 . D5 . G5 - - .',
  'F#5 - E5 - D5 - B4 - C5 - D5 - E5 - - .',
  'D5 - B4 - G4 - B4 . A4 - G4 - E4 - - .',
  'D4 - G4 - A4 - B4 - A4 - - - G4 - - -',
];
const THEME_B = [
  'B4 - D5 - G5 - F#5 - E5 - D5 - B4 - - .',
  'C5 - E5 - G5 - E5 - C5 - - - A4 - - .',
  'B4 - G4 - D5 - B4 - A4 - F#4 - A4 - - .',
  'G4 - - - D4 - - - G4 - - - . . . .',
];
const ROOTS_G = ['G2', 'C3', 'E2', 'D2', 'G2', 'C3', 'G2', 'D2'];
const CHORDS_G = [['G4', 'B4', 'D5'], ['C4', 'E4', 'G4'], ['E4', 'G4', 'B4'], ['D4', 'F#4', 'A4']];

// Main theme in natural minor (E minor), for the darker worlds.
const THEME_MINOR = [
  'E4 . G4 . B4 - - . G4 . B4 . E5 - - .',
  'D5 - C5 - B4 - G4 - A4 - B4 - C5 - - .',
  'B4 - G4 - E4 - G4 . F#4 - E4 - C4 - - .',
  'B3 - E4 - F#4 - G4 - F#4 - - - E4 - - -',
];
/** Stretch every note to twice its length: the theme "in half time" (§8.3 music_sky). */
const halfTime = (bars) =>
  bars.flatMap((bar) => {
    const doubled = bar.split(' ').flatMap((tok) => (tok === '.' ? ['.', '.'] : tok === '-' ? ['-', '-'] : [tok, '-']));
    return [doubled.slice(0, 16).join(' '), doubled.slice(16).join(' ')];
  });

const BEAT = 'k . h . s . h . k . h k s . h h';
const HATS = 'k . h . h . h . k . h . h . h .';

const BOSS_LEAD = [
  'C5 . C5 . Eb5 - C5 - G4 - - - Ab4 - G4 -',
  'F4 - Ab4 - G4 - Eb4 - D4 - Eb4 - C4 - - -',
  'C5 . C5 . Eb5 - G5 - F5 - Eb5 - D5 - Eb5 -',
  'C5 - G4 - Ab4 - B4 - C5 - - - . . . .',
];

export const SONGS = {
  music_title: {
    bpm: 100,
    tracks: [
      { wave: 'square', volume: 0.035, bars: tr(THEME, 5) },
      { wave: 'triangle', volume: 0.06, bars: CHORDS_G.map((c) => arp(c.map((n) => shift(n, 5)))) },
      { wave: 'triangle', volume: 0.14, bars: ['C3', 'F3', 'A2', 'G2'].map(hold) },
    ],
  },
  music_select: {
    bpm: 110,
    tracks: [
      { wave: 'square', volume: 0.04, bars: tr(THEME, -2) },
      { wave: 'triangle', volume: 0.16, bars: ['F2', 'Bb2', 'D2', 'C2'].map(bounce) },
      { wave: 'noise', volume: 0.5, bars: rep(HATS, 4) },
    ],
  },
  music_hills: {
    bpm: 140,
    tracks: [
      { wave: 'square', volume: 0.06, bars: [...THEME, ...THEME_B] },
      { wave: 'square', volume: 0.018, bars: [...CHORDS_G, ...CHORDS_G].map(arp) },
      { wave: 'triangle', volume: 0.17, bars: ROOTS_G.map(bounce) },
      { wave: 'noise', volume: 0.6, bars: rep(BEAT, 8) },
    ],
  },
  // Throne Hall: the music cuts to a low drone (§5.4 level 10).
  music_drone: {
    bpm: 60,
    tracks: [
      { wave: 'triangle', volume: 0.16, bars: ['C2', 'C2', 'Db2', 'C2'].map(hold) },
      { wave: 'sine', volume: 0.03, bars: ['G4', 'Gb4', 'G4', 'Ab4'].map(hold) },
    ],
  },
  // King Gloop's theme: pompous and wobbly, the main theme's rhythm in C minor.
  music_boss: {
    bpm: 170,
    tracks: [
      {
        wave: 'square',
        volume: 0.055,
        bars: BOSS_LEAD,
      },
      { wave: 'square', volume: 0.05, bars: ['C3', 'F3', 'C3', 'G3'].map(oomPah) },
      { wave: 'triangle', volume: 0.12, bars: ['C2', 'F2', 'C2', 'G2'].map(hold) },
      { wave: 'noise', volume: 0.6, bars: rep('k . h . s . h . k k h . s . h s', 4) },
    ],
  },
  // Phase 3: the same theme a semitone up, faster, with full drums.
  music_boss_final: {
    bpm: 185,
    tracks: [
      { wave: 'square', volume: 0.055, bars: tr(BOSS_LEAD, 1) },
      { wave: 'square', volume: 0.05, bars: ['C#3', 'F#3', 'C#3', 'G#3'].map(oomPah) },
      { wave: 'triangle', volume: 0.12, bars: ['C#2', 'F#2', 'C#2', 'G#2'].map(hold) },
      { wave: 'noise', volume: 0.7, bars: rep('k h s h k k s h k h s h k k s s', 4) },
    ],
  },
  // Earthy and curious; quotes the main theme in minor (D Dorian colour from the B natural in the arps).
  music_woods: {
    bpm: 128,
    tracks: [
      { wave: 'square', volume: 0.045, bars: tr(THEME_MINOR, -2) },
      { wave: 'triangle', volume: 0.05, bars: [['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4']].map(arp) },
      { wave: 'triangle', volume: 0.16, bars: ['D2', 'C2', 'G2', 'A2'].map(bounce) },
      { wave: 'noise', volume: 0.45, bars: rep('k . . h s . . h k . h . s . . h', 4) },
    ],
  },
  // Sparse and echoey: slow triangle, droplet arps, almost no drums.
  music_caves: {
    bpm: 96,
    tracks: [
      {
        wave: 'triangle',
        volume: 0.08,
        bars: [
          'A4 - - - . . E5 - - - . . C5 - - -',
          'B4 - - - . . G4 - - - . . E4 - - -',
          'F4 - - - . . A4 - - - . . C5 - - -',
          'B4 - - - . . G#4 - - - . . E4 - - -',
        ],
      },
      { wave: 'sine', volume: 0.04, bars: rep('. . . . E6 . . . . . . . . . B5 .', 2).concat(rep('. . C6 . . . . . . . A5 . . . . .', 2)) },
      { wave: 'triangle', volume: 0.14, bars: ['A2', 'G2', 'F2', 'E2'].map(hold) },
      { wave: 'noise', volume: 0.25, bars: rep('k . . . . . . . . . h . . . . .', 4) },
    ],
  },
  // Soaring, with a fast arpeggio bed; the main theme returns in half time.
  music_sky: {
    bpm: 150,
    tracks: [
      { wave: 'square', volume: 0.05, bars: halfTime(tr(THEME, -4)) },
      { wave: 'square', volume: 0.02, bars: [...CHORDS_G, ...CHORDS_G].map((c) => arp(c.map((n) => shift(n, -4)))) },
      { wave: 'triangle', volume: 0.16, bars: ROOTS_G.map((n) => bounce(shift(n, -4))) },
      { wave: 'noise', volume: 0.5, bars: rep('k . h h s . h . k . h h s . h h', 8) },
    ],
  },
  // Driving and tense: double-time hats, minor theme, low pulse bass.
  music_keep: {
    bpm: 160,
    tracks: [
      { wave: 'square', volume: 0.05, bars: THEME_MINOR },
      { wave: 'square', volume: 0.04, bars: ['E2', 'C2', 'D2', 'B1'].map((n) => `${n} ${n} . ${n} ${n} . ${n} ${n} . ${n} ${n} . ${n} . ${n} ${n}`) },
      { wave: 'triangle', volume: 0.14, bars: ['E2', 'C2', 'D2', 'B1'].map(hold) },
      { wave: 'noise', volume: 0.6, bars: rep('k h h h s h h h k h k h s h h h', 4) },
    ],
  },
  jingle_clear: {
    bpm: 120,
    loop: false,
    tracks: [
      { wave: 'square', volume: 0.07, bars: ['G4 B4 D5 G5 B4 D5 G5 B5 D6 - - - - - - -', '. . . . . . . . . . . . . . . .'] },
      { wave: 'triangle', volume: 0.18, bars: ['G2 - - - D3 - - - G3 - - - - - - -', '. . . . . . . . . . . . . . . .'] },
    ],
  },
  // Boss defeated: the main theme as a triumphant major cadence (~6 s).
  jingle_victory: {
    bpm: 120,
    loop: false,
    tracks: [
      {
        wave: 'square',
        volume: 0.07,
        bars: tr(['G4 . B4 . D5 - - . B4 . D5 . G5 - - .', 'F#5 - E5 - D5 - B4 - C5 - D5 - E5 - - .', 'D5 - F#5 - A5 - - - G5 - - - - - - -'], 5),
      },
      { wave: 'triangle', volume: 0.06, bars: tr([arp(CHORDS_G[0]), arp(CHORDS_G[1]), arp(CHORDS_G[3])], 5) },
      { wave: 'triangle', volume: 0.18, bars: ['C3', 'F2', 'G2'].map(hold) },
      { wave: 'noise', volume: 0.5, bars: ['k . h . s . h . k . h . s . h .', 'k . h . s . h . k . h . s . h .', 'k . . . . . . . . . . . . . . .'] },
    ],
  },
  // Credits / True Ending: the main theme, gentle and fully arranged.
  music_credits: {
    bpm: 120,
    tracks: [
      { wave: 'square', volume: 0.04, bars: [...THEME, ...THEME_B] },
      { wave: 'triangle', volume: 0.05, bars: [...CHORDS_G, ...CHORDS_G].map(arp) },
      { wave: 'triangle', volume: 0.15, bars: ROOTS_G.map(hold) },
      { wave: 'noise', volume: 0.3, bars: rep(HATS, 8) },
    ],
  },
};

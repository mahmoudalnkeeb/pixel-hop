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

const BEAT = 'k . h . s . h . k . h k s . h h';
const HATS = 'k . h . h . h . k . h . h . h .';

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
        bars: [
          'C5 . C5 . Eb5 - C5 - G4 - - - Ab4 - G4 -',
          'F4 - Ab4 - G4 - Eb4 - D4 - Eb4 - C4 - - -',
          'C5 . C5 . Eb5 - G5 - F5 - Eb5 - D5 - Eb5 -',
          'C5 - G4 - Ab4 - B4 - C5 - - - . . . .',
        ],
      },
      { wave: 'square', volume: 0.05, bars: ['C3', 'F3', 'C3', 'G3'].map(oomPah) },
      { wave: 'triangle', volume: 0.12, bars: ['C2', 'F2', 'C2', 'G2'].map(hold) },
      { wave: 'noise', volume: 0.6, bars: rep('k . h . s . h . k k h . s . h s', 4) },
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
};

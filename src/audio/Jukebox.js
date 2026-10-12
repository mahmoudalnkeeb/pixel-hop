import { noteToMidi, SONGS } from './songs.js';

const LOOKAHEAD = 0.12; // s of notes scheduled ahead of the audio clock
const TICK_MS = 25;
const STEPS_PER_BAR = 16;

const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Turn bar strings into per-step event lists: { wave, volume, freq | drum, steps }. */
const compile = (song) => {
  const length = Math.max(...song.tracks.map((t) => t.bars.length)) * STEPS_PER_BAR;
  const steps = Array.from({ length }, () => []);
  for (const track of song.tracks) {
    const tokens = track.bars.flatMap((bar) => {
      const t = bar.trim().split(/\s+/);
      if (t.length !== STEPS_PER_BAR) throw new Error(`Bar needs ${STEPS_PER_BAR} steps: "${bar}"`);
      return t;
    });
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '.' || tok === '-') continue;
      let len = 1;
      while (tokens[i + len] === '-') len++;
      if (track.wave === 'noise') steps[i].push({ drum: tok, volume: track.volume });
      else steps[i].push({ wave: track.wave, volume: track.volume, freq: freqOf(noteToMidi(tok)), steps: len });
    }
  }
  return { bpm: song.bpm, loop: song.loop ?? true, steps };
};

/** Lookahead step sequencer for the songs in songs.js, playing on the mixer's music bus. */
export class Jukebox {
  /** @param {import('./Mixer.js').Mixer} mixer */
  constructor(mixer) {
    this.mixer = mixer;
    this.key = null;
    this.song = null;
    this.step = 0;
    this.nextTime = null;
    this.paused = false;
    this.out = null;
    this._compiled = new Map();
    this._interval = null;
  }

  /**
   * Start a song unless it's already playing (so retries never restart the music, §8.3).
   * @param {keyof typeof SONGS} key
   * @param {{ fadeIn?: number, restart?: boolean, onEnd?: () => void }} [opts]
   */
  play(key, { fadeIn = 0, restart = false, onEnd } = {}) {
    if (key === this.key && !restart) return;
    this.stop();
    if (!this._compiled.has(key)) this._compiled.set(key, compile(SONGS[key]));
    this.key = key;
    this.song = this._compiled.get(key);
    this.step = 0;
    this.nextTime = null;
    this.onEnd = onEnd;
    this.fadeIn = fadeIn;
    this._interval = setInterval(() => this._tick(), TICK_MS);
  }

  /** Stop, optionally fading out over `fade` seconds. */
  stop(fade = 0) {
    clearInterval(this._interval);
    this._interval = null;
    this.key = null;
    const ctx = this.mixer.ctx;
    if (this.out && ctx) {
      const out = this.out;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.005, fade / 4));
      setTimeout(() => out.disconnect(), fade * 1000 + 300);
    }
    this.out = null;
  }

  setPaused(paused) {
    this.paused = paused;
    if (!paused) this.nextTime = null; // resync to the clock instead of catching up
  }

  _tick() {
    const ctx = this.mixer.ctx;
    if (!ctx || this.paused || !this.song) return;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.connect(this.mixer.buses.music);
      this.out.gain.setValueAtTime(this.fadeIn > 0 ? 0.0001 : 1, ctx.currentTime);
      if (this.fadeIn > 0) this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + this.fadeIn);
    }
    // After a hidden tab or a stall, skip ahead rather than playing a burst of late notes.
    if (this.nextTime === null || this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    const stepDur = 60 / this.song.bpm / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      for (const ev of this.song.steps[this.step]) this._schedule(ev, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= this.song.steps.length) {
        if (!this.song.loop) {
          const onEnd = this.onEnd;
          clearInterval(this._interval);
          this._interval = null;
          this.song = null;
          this.key = null;
          if (onEnd) setTimeout(onEnd, (this.nextTime - ctx.currentTime) * 1000);
          return;
        }
        this.step = 0;
      }
    }
  }

  _schedule(ev, at, stepDur) {
    const m = this.mixer;
    if (ev.drum === 'k') m.voice(this.out, { freq: 150, to: 40, duration: 0.12, type: 'triangle', volume: 0.3 * ev.volume, at });
    else if (ev.drum === 's') m.noiseHit(this.out, { duration: 0.1, volume: 0.12 * ev.volume, filter: 'bandpass', freq: 1800, at });
    else if (ev.drum === 'h') m.noiseHit(this.out, { duration: 0.03, volume: 0.06 * ev.volume, filter: 'highpass', freq: 7000, at });
    else m.voice(this.out, { freq: ev.freq, duration: ev.steps * stepDur * 0.95, type: ev.wave, volume: ev.volume, at, sustain: true });
  }
}

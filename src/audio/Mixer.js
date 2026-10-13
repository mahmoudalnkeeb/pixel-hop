// Music / SFX / UI buses with ducking and synthesized voices (GDD §8.5).
// The buses are the engine's `audio.bus()` gains, so the engine's master volume and mute apply.
// `voice` stays here because the step sequencer needs scheduled start times and a sustain envelope.

const RAMP = 0.08; // s, duck/restore without clicks
const NOISE_SECONDS = 1;

export class Mixer {
  /** @param {object} audio Engine `Audio` (provides the shared, gesture-unlocked AudioContext). */
  constructor(audio) {
    this.audio = audio;
    this.levels = { music: 0.6, sfx: 1.0, ui: 0.8 };
    this.buses = null;
    this.noise = null;
    this._duckUntil = 0;
  }

  /** The running AudioContext, or null until the first user gesture. */
  get ctx() {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    if (!this.buses) this._build(ctx);
    return ctx;
  }

  _build(ctx) {
    this.buses = {};
    for (const name of Object.keys(this.levels)) {
      const gain = this.audio.bus(name);
      gain.gain.value = this.levels[name];
      this.buses[name] = gain;
    }
    const length = ctx.sampleRate * NOISE_SECONDS;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Set a bus level 0..1 (options menu). */
  setLevel(bus, value) {
    this.levels[bus] = value;
    const ctx = this.audio.ctx;
    if (this.buses && ctx) this.buses[bus].gain.setTargetAtTime(value, ctx.currentTime, 0.02);
  }

  /** Lower the music bus by `amount` (0..1) for `duration` seconds (§8.4 ducking). */
  duck(amount, duration) {
    const ctx = this.ctx;
    if (!ctx) return;
    const gain = this.buses.music.gain;
    const now = ctx.currentTime;
    const level = this.levels.music;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(level * (1 - amount), now + RAMP);
    const end = Math.max(now + RAMP + duration, this._duckUntil);
    this._duckUntil = end;
    gain.setValueAtTime(level * (1 - amount), end);
    gain.linearRampToValueAtTime(level, end + RAMP);
  }

  /** Hold the music bus at a ducked level until `unduck` (pause menu). */
  hold(amount) {
    const ctx = this.ctx;
    if (!ctx) return;
    const gain = this.buses.music.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setTargetAtTime(this.levels.music * (1 - amount), ctx.currentTime, 0.03);
  }

  unduck() {
    const ctx = this.ctx;
    if (!ctx) return;
    const gain = this.buses.music.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setTargetAtTime(this.levels.music, ctx.currentTime, 0.03);
  }

  /**
   * A pitched voice with an exponential pitch glide and decay envelope.
   * @param {'music'|'sfx'|'ui'|AudioNode} bus Bus name or a node routed into one.
   * @param {{ freq: number, to?: number, duration: number, type?: OscillatorType, volume?: number, at?: number, sustain?: boolean }} v
   *   `at` is an absolute AudioContext time; `sustain` holds the level until the end (music notes).
   */
  voice(bus, { freq, to, duration, type = 'square', volume = 0.2, at, sustain = false }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = at ?? ctx.currentTime;
    const end = start + duration;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.005);
    if (sustain) gain.gain.setValueAtTime(volume, Math.max(start + 0.005, end - 0.03));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(typeof bus === 'string' ? this.buses[bus] : bus);
    osc.start(start);
    osc.stop(end + 0.01);
  }

  /** Filtered noise burst: hats, snares, rumbles. */
  noiseHit(bus, { duration, volume = 0.1, filter = 'highpass', freq = 6000, at }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(biquad).connect(gain).connect(typeof bus === 'string' ? this.buses[bus] : bus);
    src.start(start, Math.random() * (NOISE_SECONDS - duration - 0.01));
    src.stop(start + duration + 0.01);
  }
}

import { SHAKE_SCALE } from '../config.js';
import { cycle, ListScene } from '../ui/ListScene.js';

const pct = (v) => `${Math.round(v * 100)}%`;

/** Volumes, accessibility and controls (§9.1, §9.5). Pushed from the title or pause menu. */
export class OptionsScene extends ListScene {
  title() {
    return 'OPTIONS';
  }

  rows() {
    const o = this.save.options;
    o.timer ??= true;
    o.flashing ??= 'normal';
    o.captions ??= false;
    const volume = (bus) => (d) => {
      o[bus] = Math.round(Math.max(0, Math.min(1, o[bus] + d * 0.1)) * 10) / 10;
      this.game.mixer.setLevel(bus, o[bus]);
    };
    return [
      { name: 'Music', get: () => pct(o.music), change: volume('music') },
      { name: 'SFX', get: () => pct(o.sfx), change: volume('sfx'), sound: 'coin' },
      { name: 'UI', get: () => pct(o.ui), change: volume('ui') },
      { name: 'Screen shake', get: () => o.shake, change: (d) => (o.shake = cycle(Object.keys(SHAKE_SCALE), o.shake, d)) },
      { name: 'Flashing', get: () => o.flashing, change: (d) => (o.flashing = cycle(['normal', 'reduced'], o.flashing, d)) },
      { name: 'Boss captions', get: () => (o.captions ? 'on' : 'off'), change: () => (o.captions = !o.captions) },
      { name: 'Timer', get: () => (o.timer ? 'shown' : 'hidden'), change: () => (o.timer = !o.timer) },
      { name: 'Assist Mode', open: 'assist_options' },
      { name: 'Controls', open: 'controls' },
      { name: 'Back', back: true },
    ];
  }
}

/**
 * Assist Mode (§9.5): independent toggles. Nothing is lost by using them; clear screens just show a small
 * assist icon for transparency.
 */
export class AssistOptionsScene extends ListScene {
  title() {
    return 'ASSIST MODE';
  }

  footer() {
    return 'No medals are lost. Esc back';
  }

  rows() {
    const a = this.save.options.assist;
    a.skip ??= false;
    return [
      { name: 'Game speed', get: () => pct(a.speed), change: (d) => (a.speed = cycle([1, 0.85, 0.7], a.speed, d)) },
      { name: 'Hearts', get: () => String(a.hearts), change: (d) => (a.hearts = cycle([3, 5], a.hearts, d)) },
      { name: 'Invincibility', get: () => (a.invincible ? 'on' : 'off'), change: () => (a.invincible = !a.invincible) },
      { name: 'Skip level (pause menu)', get: () => (a.skip ? 'on' : 'off'), change: () => (a.skip = !a.skip) },
      { name: 'Back', back: true },
    ];
  }
}

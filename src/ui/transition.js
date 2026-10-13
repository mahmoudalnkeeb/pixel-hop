import { VIEW_H, VIEW_W } from '../config.js';

const FADE = 0.3; // seconds

/**
 * Fades in from black whenever the bottom scene changes (a switch, not a push), so cuts between
 * title, map and levels aren't abrupt. Drawn from the game overlay, above every scene.
 */
export class Transition {
  constructor(game) {
    this.game = game;
    this.scene = null;
    this.alpha = 0;
    this.last = performance.now();
  }

  render(r) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const base = this.game.scenes.stack[0] ?? null;
    if (base !== this.scene) {
      this.scene = base;
      this.alpha = 1;
    }
    if (this.alpha <= 0) return;
    r.rect(0, 0, VIEW_W, VIEW_H, `rgba(8,6,18,${this.alpha})`);
    this.alpha -= dt / FADE;
  }
}

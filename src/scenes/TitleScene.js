import { Scene } from '../../vendor/h3-engine.min.js';
import { CONFIRM, LEVELS, VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { loadSave } from '../save.js';
import { sfx } from '../sfx.js';
import { label } from '../ui/label.js';

/** Logo and "Press Start". Waiting for a key also unlocks browser audio (Appendix B). */
export class TitleScene extends Scene {
  enter() {
    this.ctx.renderer.background = WORLDS[1].sky;
    this.t = 0;
    this.hop = { y: 0 };
    const save = loadSave();
    // Continue from the furthest unlocked level that exists in this build.
    this.startLevel = LEVELS[Math.min(save.unlocked, LEVELS.length) - 1];
  }

  update(dt, { input, audio }) {
    this.t += dt;
    if (input.justPressed(CONFIRM)) {
      sfx(audio, 'ui_confirm');
      this.game.scenes.switch('play', { level: this.startLevel });
    }
  }

  render(r) {
    const cx = VIEW_W / 2;
    r.rect(0, VIEW_H - 40, VIEW_W, 40, WORLDS[1].ground);
    r.rect(0, VIEW_H - 40, VIEW_W, 5, WORLDS[1].top);
    // Hop bouncing on the title.
    const bounce = Math.abs(Math.sin(this.t * 3)) * 30;
    const y = Math.round(VIEW_H - 40 - 14 - bounce);
    r.rect(cx - 6, y, 12, 14, '#ff5e5b');
    r.rect(cx - 3, y + 3, 3, 4, '#fff');
    r.rect(cx + 1, y + 3, 3, 4, '#fff');
    label(r, 'PIXEL HOP', cx, 30, { size: 24, color: '#ffd23f' });
    if (Math.floor(this.t * 2) % 2 === 0) label(r, 'Press Enter', cx, 80);
    label(r, 'Arrows/WASD move   Space jump   Esc pause', cx, VIEW_H - 22, { size: 8 });
  }
}

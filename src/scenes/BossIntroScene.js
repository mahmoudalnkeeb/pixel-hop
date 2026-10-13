import { Scene } from '../../vendor/h3-engine.min.js';
import { BOSS_FRAMES, bossSheet } from '../art/boss.js';
import { VIEW_H, VIEW_W } from '../config.js';
import { label } from '../ui/label.js';

const LENGTH = 3;

/** 3 s title card for King Gloop. Non-interactive the first time, skippable after (§9.1). Pops with 'boss_intro'. */
export class BossIntroScene extends Scene {
  enter({ firstTime = true } = {}) {
    this.firstTime = firstTime;
    this.t = 0;
    this.card = { slide: 0 };
    this.tween(this.card, { slide: 1 }, 0.5, 'backOut');
  }

  update(dt, { input }) {
    this.t += dt;
    const skip = !this.firstTime && this.t > 0.3 && input.anyPressed();
    if (this.t >= LENGTH || skip) this.game.scenes.pop('boss_intro');
  }

  render(r) {
    const k = this.card.slide;
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,5,20,0.75)');
    r.rect(0, 50, VIEW_W, 80, '#2a1f3d');
    r.rect(0, 50, VIEW_W, 2, '#ffd23f');
    r.rect(0, 128, VIEW_W, 2, '#ffd23f');
    const wob = Math.sin(this.t * 6) * 0.04;
    r.sprite(bossSheet().frame(BOSS_FRAMES.roar), Math.round(VIEW_W / 2 - 90 - (1 - k) * 120), 124, { w: Math.round(56 * (1.1 + wob)), h: Math.round(48 * (1.1 - wob)) });
    label(r, 'KING GLOOP', Math.round(VIEW_W / 2 + 40 + (1 - k) * 200), 68, { size: 16, color: '#9be36b' });
    label(r, 'Swallower of the Sun Seed', Math.round(VIEW_W / 2 + 40 + (1 - k) * 260), 92, { color: '#ffd23f' });
    if (!this.firstTime && this.t > 0.3) label(r, this.game.touch?.visible ? 'tap: skip' : 'any key: skip', VIEW_W - 40, VIEW_H - 14, { color: '#aab' });
  }
}

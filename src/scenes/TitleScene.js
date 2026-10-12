import { Scene } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { label } from '../ui/label.js';
import { Menu } from '../ui/Menu.js';

/** Logo and menu. Browsers keep audio silent until the first key press (Appendix B). */
export class TitleScene extends Scene {
  enter() {
    this.ctx.renderer.background = WORLDS[1].sky;
    this.t = 0;
    this.menu = new Menu([
      { text: 'Play', value: 'play' },
      { text: 'Options', value: 'options' },
    ]);
    // Starts as soon as the first key press unlocks audio.
    this.game.jukebox.play('music_title');
  }

  update(dt, ctx) {
    this.t += dt;
    const choice = this.menu.update(ctx);
    if (choice === 'play') this.game.scenes.switch('select');
    else if (choice === 'options') this.game.scenes.push('options');
  }

  resume() {
    this.game.jukebox.play('music_title');
  }

  render(r) {
    const cx = VIEW_W / 2;
    r.rect(0, VIEW_H - 40, VIEW_W, 40, WORLDS[1].ground);
    r.rect(0, VIEW_H - 40, VIEW_W, 4, WORLDS[1].top);
    // Hop bouncing on the title.
    const bounce = Math.abs(Math.sin(this.t * 3));
    const squash = bounce < 0.15 ? 1 - (0.15 - bounce) * 2 : 1;
    r.sprite(characters().frame(bounce > 0.5 ? FRAMES.hop_up : FRAMES.hop_idle), cx, Math.round(VIEW_H - 40 - bounce * 30), {
      w: Math.round(16 * (2 - squash)),
      h: Math.round(16 * squash),
    });
    r.sprite(characters().frame(FRAMES.slime), cx + 60, VIEW_H - 40, { flipX: true });
    label(r, 'PIXEL HOP', cx, 26, { size: 24, color: '#ffd23f' });
    this.menu.render(r, cx, 74);
    label(r, 'Arrows/WASD move   Space jump   Esc pause', cx, VIEW_H - 22);
  }
}

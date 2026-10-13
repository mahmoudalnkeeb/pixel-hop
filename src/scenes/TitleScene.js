import { Scene } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { decor } from '../art/decor.js';
import { hash2 } from '../art/paint.js';
import { groundFrame, OPEN, tiles } from '../art/tiles.js';
import { T, VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { Backdrop } from '../world/Backdrop.js';
import { label } from '../ui/label.js';
import { Menu } from '../ui/Menu.js';

const SCROLL = 24; // px/s
const GROUND_H = 40;

/** Logo and menu. Browsers keep audio silent until the first key press (Appendix B). */
export class TitleScene extends Scene {
  enter() {
    this.taps = true; // touch: tap a menu item to choose it
    this.ctx.renderer.background = WORLDS[1].sky;
    this.t = 0;
    // The Green Hills backdrop scrolls past as if Hop were hopping along; Backdrop reads level.h.
    this.level = { h: VIEW_H };
    this.add(new Backdrop(1));
    this.menu = new Menu([
      { text: 'Play', value: 'play' },
      { text: 'Options', value: 'options' },
    ]);
    // Starts as soon as the first key press unlocks audio.
    this.game.jukebox.play('music_title');
  }

  update(dt, ctx) {
    this.t += dt;
    this.camera.x += SCROLL * dt;
    const choice = this.menu.update(ctx, this.game.touch?.takeTap());
    if (choice === 'play') this.game.scenes.switch('select');
    else if (choice === 'options') this.game.scenes.push('options');
  }

  /** Real Green Hills tiles and decorations, scrolling with the camera. */
  renderGround(r) {
    const sheet = tiles(1);
    const props = decor(1);
    const scroll = Math.floor(this.camera.x);
    const top = VIEW_H - GROUND_H;
    for (let col = Math.floor(scroll / T); col * T - scroll < VIEW_W; col++) {
      const x = col * T - scroll;
      const variant = hash2(col, 1) > 0.6 ? 1 : 0;
      r.sprite(sheet.frame(groundFrame(OPEN.top, variant)), x, top);
      for (let y = top + T; y < VIEW_H; y += T) r.sprite(sheet.frame(groundFrame(0, hash2(col, y) > 0.6 ? 1 : 0)), x, y);
      if (hash2(col, 7) < 0.45) r.sprite(props.sheet.frame(Math.floor(hash2(col, 3) * props.top)), x, top - T);
    }
  }

  resume() {
    this.game.jukebox.play('music_title');
  }

  render(r) {
    const cx = Math.floor(VIEW_W / 2);
    this.renderGround(r);
    // Hop bouncing on the title.
    const bounce = Math.abs(Math.sin(this.t * 3));
    const squash = bounce < 0.15 ? 1 - (0.15 - bounce) * 2 : 1;
    r.sprite(characters().frame(bounce > 0.5 ? FRAMES.hop_up : FRAMES.hop_idle), cx, Math.round(VIEW_H - GROUND_H - bounce * 30), {
      w: Math.round(16 * (2 - squash)),
      h: Math.round(16 * squash),
    });
    // A slime giving chase, waddling.
    const waddle = Math.sin(this.t * 10) * 0.06;
    r.sprite(characters().frame(FRAMES.slime), cx - 64, VIEW_H - GROUND_H, { w: Math.round(16 * (1 + waddle)), h: Math.round(16 * (1 - waddle)) });
    if (this.game.scenes.current !== this) return; // Options is open on top: keep the scenery, drop the text
    label(r, 'PIXEL HOP', cx, 26, { size: 24, color: '#ffd23f', wave: this.t });
    this.menu.render(r, cx, 74);
    const hint = this.game.touch?.visible ? 'Left side: move   Right side: jump' : 'Arrows/WASD move   Space jump   Esc pause';
    label(r, hint, cx, VIEW_H - 22);
  }
}

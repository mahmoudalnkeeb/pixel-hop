import { Scene } from '../../vendor/h3-engine.min.js';
import { BACK, CONFIRM, VIEW_H, VIEW_W } from '../config.js';
import { sfx } from '../sfx.js';
import { formatTime } from '../ui/hud.js';
import { label } from '../ui/label.js';

const ROW = 12;

/** Level clear summary, pushed over the play scene (§9.1). Rows animate in one by one. */
export class ClearScene extends Scene {
  enter(stats) {
    this.stats = stats;
    const s = stats;
    const gems = s.gems.slice(0, s.gemTotal).map((g) => (g ? '*' : '-')).join(' ');
    this.rows = [
      s.par > 0 ? `Time   ${formatTime(s.time)}  (par ${formatTime(s.par)})` : `Time   ${formatTime(s.time)}`,
      `Coins  ${s.coins}/${s.coinTotal}${s.coins === s.coinTotal ? '  ALL!' : ''}`,
      s.gemTotal > 0 ? `Gems   ${gems}` : null,
      `Deaths ${s.deaths}`,
      s.par > 0 ? `Bonus  ${s.timeBonus}` : null,
      `Score  ${s.score}`,
    ].filter(Boolean);
    this.panel = { y: -VIEW_H, shown: 0 };
    this.ticked = 0;
    this.tween(this.panel, { y: 0 }, 0.4, 'backOut');
    this.tween(this.panel, { shown: this.rows.length + 1 }, 1.2, 'linear', { delay: 0.4 });
  }

  get done() {
    return this.panel.shown >= this.rows.length + 1;
  }

  update(_dt, { input }) {
    // A tick as each row lands.
    const shown = Math.floor(this.panel.shown);
    if (shown > this.ticked && shown <= this.rows.length) sfx('ui_move');
    this.ticked = shown;
    if (!this.done) return;
    const { next, levelId } = this.stats;
    if (input.justPressed(CONFIRM)) {
      sfx('ui_confirm');
      if (next) this.game.scenes.switch('play', { level: next });
      else this.game.scenes.switch('select', { level: levelId });
    } else if (input.justPressed(BACK)) {
      sfx('ui_back');
      this.game.scenes.switch('select', { level: levelId });
    }
  }

  render(r) {
    const s = this.stats;
    const y = Math.round(this.panel.y);
    const cx = VIEW_W / 2;
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.55)');
    r.rect(60, y + 20, 200, 140, 'rgba(20,20,45,0.92)');
    r.strokeRect(60.5, y + 20.5, 199, 139, '#ffd23f');
    label(r, 'LEVEL CLEAR!', cx, y + 28, { size: 16, color: '#ffd23f' });
    label(r, s.name ?? `Level ${s.levelId}`, cx, y + 46);
    const rows = this.rows;
    const shown = Math.floor(this.panel.shown);
    for (let i = 0; i < Math.min(shown, rows.length); i++) label(r, rows[i], 80, y + 64 + i * ROW, { align: 'left' });
    if (this.done) label(r, s.next ? 'Enter: next level   Esc: map' : 'Enter: map', cx, y + 140, { color: '#9be36b' });
  }
}

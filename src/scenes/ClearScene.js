import { Scene } from '../../vendor/h3-engine.min.js';
import { CONFIRM, VIEW_H, VIEW_W } from '../config.js';
import { sfx } from '../sfx.js';
import { formatTime } from '../ui/hud.js';
import { label } from '../ui/label.js';

const ROW = 12;

/** Level clear summary, pushed over the play scene (§9.1). Rows animate in one by one. */
export class ClearScene extends Scene {
  enter(stats) {
    this.stats = stats;
    this.panel = { y: -VIEW_H, shown: 0 };
    this.tween(this.panel, { y: 0 }, 0.4, 'backOut');
    this.tween(this.panel, { shown: 7 }, 1.2, 'linear', { delay: 0.4 });
  }

  update(_dt, { input, audio }) {
    if (this.panel.shown < 7 || !input.justPressed(CONFIRM)) return;
    sfx(audio, 'ui_confirm');
    const { next } = this.stats;
    if (next) this.game.scenes.switch('play', { level: next });
    else this.game.scenes.switch('title');
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
    const gems = s.gems.map((g) => (g ? '*' : '-')).join(' ');
    const rows = [
      `Time   ${formatTime(s.time)}  (par ${formatTime(s.par)})`,
      `Coins  ${s.coins}/${s.coinTotal}${s.coins === s.coinTotal ? '  ALL!' : ''}`,
      `Gems   ${gems}`,
      `Deaths ${s.deaths}`,
      `Bonus  ${s.timeBonus}`,
      `Score  ${s.score}`,
    ];
    const shown = Math.floor(this.panel.shown);
    for (let i = 0; i < Math.min(shown, rows.length); i++) label(r, rows[i], 80, y + 64 + i * ROW, { align: 'left' });
    if (shown >= 7) label(r, s.next ? 'Enter: next level' : 'Enter: title', cx, y + 140, { color: '#9be36b' });
  }
}

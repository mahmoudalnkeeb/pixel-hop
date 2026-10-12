import { Scene } from '../../vendor/h3-engine.min.js';
import { BACK, CONFIRM, LEFT, MENU_DOWN, MENU_UP, RIGHT, VIEW_H, VIEW_W } from '../config.js';
import { loadSave, writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { label } from '../ui/label.js';

const SHAKES = ['on', 'reduced', 'off'];
const pct = (v) => `${Math.round(v * 100)}%`;

/** Volumes, screen shake and timer (§9.1). Pushed from the title or pause menu; saves on every change (§9.6). */
export class OptionsScene extends Scene {
  enter() {
    this.save = loadSave();
    this.index = 0;
    const o = this.save.options;
    o.timer ??= true;
    this.rows = [
      { name: 'Music', get: () => pct(o.music), change: (d) => this.volume('music', d) },
      { name: 'SFX', get: () => pct(o.sfx), change: (d) => this.volume('sfx', d) },
      { name: 'UI', get: () => pct(o.ui), change: (d) => this.volume('ui', d) },
      { name: 'Screen shake', get: () => o.shake, change: (d) => (o.shake = SHAKES[(SHAKES.indexOf(o.shake) + d + 3) % 3]) },
      { name: 'Timer', get: () => (o.timer ? 'shown' : 'hidden'), change: () => (o.timer = !o.timer) },
      { name: 'Back', get: () => '', back: true },
    ];
  }

  volume(bus, d) {
    const o = this.save.options;
    o[bus] = Math.round(Math.max(0, Math.min(1, o[bus] + d * 0.1)) * 10) / 10;
    this.game.mixer.setLevel(bus, o[bus]);
  }

  update(_dt, { input }) {
    const move = (input.justPressed(MENU_DOWN) ? 1 : 0) - (input.justPressed(MENU_UP) ? 1 : 0);
    if (move) {
      this.index = (this.index + move + this.rows.length) % this.rows.length;
      sfx('ui_move');
    }
    const row = this.rows[this.index];
    const d = (input.justPressed(RIGHT) ? 1 : 0) - (input.justPressed(LEFT) ? 1 : 0);
    if ((d || input.justPressed(CONFIRM)) && row.change) {
      row.change(d || 1);
      writeSave(this.save);
      sfx(row.name === 'SFX' ? 'coin' : 'ui_confirm');
    }
    if (input.justPressed(BACK) || (row.back && input.justPressed(CONFIRM))) {
      sfx('ui_back');
      this.game.scenes.pop('options');
    }
  }

  render(r) {
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.8)');
    label(r, 'OPTIONS', VIEW_W / 2, 24, { size: 16 });
    this.rows.forEach((row, i) => {
      const y = 56 + i * 16;
      const color = i === this.index ? '#ffd23f' : '#fff';
      label(r, row.name, 90, y, { align: 'left', color });
      if (!row.back) label(r, `< ${row.get()} >`, 230, y, { align: 'right', color });
    });
    label(r, 'Left/Right change   Esc back', VIEW_W / 2, VIEW_H - 16, { color: '#aab' });
  }
}

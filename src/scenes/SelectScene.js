import { Scene } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { BACK, BUILT_LEVELS, CONFIRM, LEFT, LEVEL_NAMES, LEVELS, RIGHT, VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { levelRecord, loadSave } from '../save.js';
import { sfx } from '../sfx.js';
import { formatTime } from '../ui/hud.js';
import { label } from '../ui/label.js';

const WORLD_OF = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
const node = (i) => ({ x: 26 + i * 29.8, y: 78 + (i % 2 === 0 ? 0 : -16) + (i >= 8 ? -8 : 0) });

/** World map with 10 nodes, medals per level, and locked levels greyed out (§9.1). Takes `{ level }` to start the cursor there. */
export class SelectScene extends Scene {
  enter({ level } = {}) {
    this.ctx.renderer.background = '#1c2a3a';
    this.save = loadSave();
    const reachable = Math.min(this.save.unlocked, LEVELS.length) - 1;
    const start = level ? LEVELS.indexOf(level) : reachable;
    this.index = Math.max(0, Math.min(start, LEVELS.length - 1));
    this.t = 0;
    this.game.jukebox.play('music_select', { fadeIn: 0.3 });
  }

  /** @returns {'open' | 'locked' | 'soon'} */
  status(i) {
    if (!BUILT_LEVELS.includes(LEVELS[i])) return 'soon';
    return i < this.save.unlocked || this.game.devUnlock ? 'open' : 'locked';
  }

  update(dt, { input }) {
    this.t += dt;
    const d = (input.justPressed(RIGHT) ? 1 : 0) - (input.justPressed(LEFT) ? 1 : 0);
    if (d) {
      const next = this.index + d;
      if (next >= 0 && next < LEVELS.length) {
        this.index = next;
        sfx('ui_move');
      }
    }
    if (input.justPressed(CONFIRM)) {
      if (this.status(this.index) === 'open') {
        sfx('ui_confirm');
        this.game.scenes.switch('play', { level: LEVELS[this.index] });
      } else {
        sfx('ui_back');
      }
    } else if (input.justPressed(BACK)) {
      sfx('ui_back');
      this.game.scenes.switch('title');
    }
  }

  render(r) {
    // World bands behind the path.
    for (let w = 1; w <= 5; w++) {
      const x0 = Math.round(node((w - 1) * 2).x - 14);
      r.rect(x0, 40, 60, 80, WORLDS[w].sky);
      r.rect(x0, 104, 60, 16, WORLDS[w].ground);
      r.rect(x0, 104, 60, 3, WORLDS[w].top);
    }
    label(r, 'HOPSHIRE', VIEW_W / 2, 14, { size: 16, color: '#ffd23f' });

    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = node(i);
      const b = node(i + 1);
      const steps = 6;
      for (let s = 1; s < steps; s++) {
        const x = Math.round(a.x + ((b.x - a.x) * s) / steps);
        const y = Math.round(a.y + ((b.y - a.y) * s) / steps);
        r.rect(x, y, 2, 2, i + 1 < this.save.unlocked ? '#fff6b0' : 'rgba(255,255,255,0.35)');
      }
    }
    for (let i = 0; i < LEVELS.length; i++) {
      const { x, y } = node(i);
      const status = this.status(i);
      const rec = this.save.levels[LEVELS[i]];
      const fill = status === 'open' ? (rec?.cleared ? '#9be36b' : '#ffd23f') : status === 'locked' ? '#6b6b7a' : '#3a3a48';
      const nx = Math.round(x);
      const ny = Math.round(y);
      r.rect(nx - 6, ny - 4, 12, 8, '#1d1d2b');
      r.rect(nx - 5, ny - 3, 10, 6, fill);
      label(r, LEVELS[i], nx, ny + 6, { color: status === 'soon' ? '#888' : '#fff' });
      if (i === LEVELS.length - 1) {
        r.rect(nx - 4, ny - 9, 8, 3, '#ffd23f'); // the King's crown marks the throne
        r.rect(nx - 4, ny - 11, 2, 2, '#ffd23f');
        r.rect(nx + 2, ny - 11, 2, 2, '#ffd23f');
      }
    }
    // Hop on the selected node.
    const sel = node(this.index);
    const hop = Math.abs(Math.sin(this.t * 4)) * 4;
    r.sprite(characters().frame(FRAMES.hop_idle), Math.round(sel.x), Math.round(sel.y - 4 - hop));

    this.renderInfo(r);
  }

  renderInfo(r) {
    const i = this.index;
    const id = LEVELS[i];
    const status = this.status(i);
    const y = 128;
    r.rect(20, y - 4, VIEW_W - 40, 50, 'rgba(10,10,30,0.85)');
    label(r, `${id}. ${LEVEL_NAMES[i]}`, VIEW_W / 2, y, { color: WORLDS[WORLD_OF[i]].accent });
    if (status === 'soon') {
      label(r, 'Coming soon', VIEW_W / 2, y + 16, { color: '#aab' });
      return;
    }
    if (status === 'locked') {
      label(r, 'Locked: clear the previous level', VIEW_W / 2, y + 16, { color: '#aab' });
      return;
    }
    const rec = levelRecord(this.save, id);
    // Medals (§4.4): 3 gems, all coins, par time. Level 10 has no gems.
    const medals = [];
    if (i < 9) medals.push(`Gems ${rec.gems.map((g) => (g ? '*' : '-')).join('')}`);
    medals.push(`Coins ${rec.allCoins ? '*' : '-'}`);
    if (i < 9) medals.push(`Par ${rec.parTime ? '*' : '-'}`);
    label(r, medals.join('   '), VIEW_W / 2, y + 14);
    const best = rec.bestTime === null ? '--:--' : formatTime(rec.bestTime);
    label(r, `Best ${best}    Enter: play   Esc: title`, VIEW_W / 2, y + 28, { color: '#aab' });
  }
}

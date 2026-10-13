import { Scene } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { groundFrame, OPEN, shade, tiles } from '../art/tiles.js';
import { panel } from '../ui/panel.js';
import { BACK, BUILT_LEVELS, CONFIRM, LEFT, LEVEL_NAMES, LEVELS, RIGHT, VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { levelRecord, loadSave } from '../save.js';
import { sfx } from '../sfx.js';
import { formatTime } from '../ui/hud.js';
import { label } from '../ui/label.js';

const WORLD_OF = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
// Laid out for 320 px and centred in wider views.
const node = (i) => ({ x: (VIEW_W - 320) / 2 + 26 + i * 29.8, y: 78 + (i % 2 === 0 ? 0 : -16) + (i >= 8 ? -8 : 0) });

/** A crisp pixel disc, row by row (canvas arcs are anti-aliased). */
const disc = (r, cx, cy, radius, color) => {
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.round(Math.sqrt(radius * radius - dy * dy));
    r.rect(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
};

/** A rounded hill silhouette standing on `base`. */
const hill = (r, cx, base, rx, ry, color) => {
  for (let dy = 0; dy < ry; dy++) {
    const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
    r.rect(cx - half, base - ry + (ry - dy) - 1, half * 2, 1, color);
  }
};

/** World map with 10 nodes, medals per level, and locked levels greyed out (§9.1). Takes `{ level }` to start the cursor there. */
export class SelectScene extends Scene {
  enter({ level } = {}) {
    this.taps = true; // touch: tap a level to select it, tap it again to play
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
    const tap = this.game.touch?.takeTap();
    const tapped = tap ? LEVELS.findIndex((_, i) => Math.abs(node(i).x - tap.x) < 14 && Math.abs(node(i).y - tap.y) < 16) : -1;
    // Tapping the selected level again, or the info panel below the map, plays it.
    const tapAgain = (tapped >= 0 && tapped === this.index) || (tap?.y ?? 0) > 124;
    if (tapped >= 0 && !tapAgain) {
      this.index = tapped;
      sfx('ui_move');
    }
    const d = (input.justPressed(RIGHT) ? 1 : 0) - (input.justPressed(LEFT) ? 1 : 0);
    if (d) {
      const next = this.index + d;
      if (next >= 0 && next < LEVELS.length) {
        this.index = next;
        sfx('ui_move');
      }
    }
    if (input.justPressed(CONFIRM) || tapAgain) {
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
    // World bands behind the path: a stepped sky, a hill silhouette and the world's own ground tiles.
    const left = Math.round(node(0).x - 14);
    panel(r, left - 3, 37, 304, 86, { fill: '#0e0b1c' });
    for (let w = 1; w <= 5; w++) {
      const x0 = Math.round(node((w - 1) * 2).x - 14);
      const sky = WORLDS[w].sky;
      for (let band = 0; band < 4; band++) r.rect(x0, 40 + band * 16, 60, 16, shade(sky, band * 0.07 - 0.08));
      for (const [hx, hr] of [[18, 18], [46, 13]]) hill(r, x0 + hx, 104, hr, Math.round(hr * 0.6), shade(sky, -0.25));
      const sheet = tiles(w);
      for (let i = 0; i < 4; i++) r.sprite(sheet.frame(groundFrame(OPEN.top, i % 2)), x0 + i * 15, 104);
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
      // A map pin: a pale stone ringed in the level's status colour; the selected one pulses.
      if (i === this.index) disc(r, nx, ny, 7 + Math.round(Math.abs(Math.sin(this.t * 4))), 'rgba(255,255,255,0.35)');
      disc(r, nx, ny, 6, '#1d1d2b');
      disc(r, nx, ny, 5, fill);
      disc(r, nx, ny, 3, status === 'open' ? '#f4ecd8' : '#8a8494');
      r.rect(nx - 1, ny - 2, 2, 1, '#ffffff');
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
    panel(r, 20, y - 6, VIEW_W - 40, 52);
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
    label(r, `Best ${best}    ${this.game.touch?.visible ? 'Tap again: play' : 'Enter: play   Esc: title'}`, VIEW_W / 2, y + 28, { color: '#aab' });
  }
}

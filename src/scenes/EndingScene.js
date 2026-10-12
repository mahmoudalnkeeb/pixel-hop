import { Scene } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES, GOLD } from '../art/characters.js';
import { CONFIRM, LEVELS, VIEW_H, VIEW_W, WORLDS } from '../config.js';
import { loadSave, writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { formatTime } from '../ui/hud.js';
import { label } from '../ui/label.js';

const ALL_GEMS = 27;
const CREDITS = [
  'PIXEL HOP',
  '',
  'A game by',
  'Mahmoud Alnakeeb',
  '',
  'Design, code and every last pixel',
  'Mahmoud Alnakeeb',
  '',
  'Engine',
  'h3-engine, built from scratch',
  'by Mahmoud Alnakeeb',
  '',
  'Music and sound',
  'Chiptune, synthesized live in your browser',
  '',
  'King Gloop',
  'as himself',
  '',
  'Special thanks',
  'to everyone who hopped this far',
  '',
  'Thanks for bringing the Sun Seed home.',
];

/** Victory stats, credits, and the True Ending when all 27 Sun Gems are found (§6.5, §9.1). */
export class EndingScene extends Scene {
  enter({ assisted = false } = {}) {
    this.ctx.renderer.background = WORLDS[1].sky;
    const save = loadSave();
    const records = LEVELS.map((id) => save.levels[id]).filter(Boolean);
    this.gems = records.reduce((n, rec) => n + rec.gems.filter(Boolean).length, 0);
    this.time = records.reduce((t, rec) => t + (rec.bestTime ?? 0), 0);
    this.deaths = records.reduce((n, rec) => n + (rec.deaths ?? 0), 0);
    this.coinMedals = records.filter((rec) => rec.allCoins).length;
    this.trueEnding = this.gems >= ALL_GEMS;
    this.assisted = assisted;
    if (this.trueEnding && !save.golden) {
      save.golden = true; // "Golden Hop" palette (§4.4)
      writeSave(save);
    }
    this.page = 'stats'; // stats | credits | epilogue
    this.t = 0;
    this.scroll = 0;
    this.game.jukebox.play('music_credits', { fadeIn: 1 });
  }

  update(dt, { input }) {
    this.t += dt;
    if (this.page === 'credits') this.scroll += dt * 18;
    const creditsDone = this.scroll > CREDITS.length * 14 + VIEW_H;
    if (!input.justPressed(CONFIRM) && !(this.page === 'credits' && creditsDone)) return;
    sfx('ui_confirm');
    if (this.page === 'stats') {
      this.page = 'credits';
      this.scroll = 0;
    } else if (this.page === 'credits' && this.trueEnding) {
      this.page = 'epilogue';
      this.t = 0;
    } else {
      this.game.scenes.switch('title');
    }
  }

  render(r) {
    if (this.page === 'stats') this.renderStats(r);
    else if (this.page === 'credits') this.renderCredits(r);
    else this.renderEpilogue(r);
  }

  renderStats(r) {
    const cx = VIEW_W / 2;
    this.meadow(r, 0.4);
    r.rect(50, 20, 220, 130, 'rgba(20,20,45,0.85)');
    label(r, 'THE SUN SEED IS HOME!', cx, 28, { size: 16, color: '#ffd23f' });
    label(r, 'Colour returns to Hopshire.', cx, 50);
    const rows = [
      `Total time    ${formatTime(this.time)}`,
      `Deaths        ${this.deaths}`,
      `Sun Gems      ${this.gems}/${ALL_GEMS}`,
      `Coin medals   ${this.coinMedals}/${LEVELS.length}`,
    ];
    rows.forEach((row, i) => label(r, row, 80, 72 + i * 13, { align: 'left' }));
    if (this.assisted) label(r, '(assist)', cx, 126, { color: '#aab' });
    label(r, 'Enter: credits', cx, 136, { color: '#9be36b' });
  }

  renderCredits(r) {
    r.rect(0, 0, VIEW_W, VIEW_H, '#141625');
    CREDITS.forEach((line, i) => {
      const y = Math.round(VIEW_H - this.scroll + i * 14);
      if (y < -10 || y > VIEW_H) return;
      label(r, line, VIEW_W / 2, y, { color: i === 0 ? '#ffd23f' : '#fff', size: i === 0 ? 16 : 8 });
    });
    const hop = Math.abs(Math.sin(this.t * 4)) * 6;
    r.sprite(characters().frame(FRAMES.hop_idle), VIEW_W - 20, Math.round(VIEW_H - 8 - hop));
  }

  /** True Ending: Hopshire in full bloom, and the Golden Hop palette. */
  renderEpilogue(r) {
    this.meadow(r, 1);
    const flowers = ['#ff5e7a', '#ffd23f', '#ff8fb1', '#6fe3ff', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      const x = (i * 53) % VIEW_W;
      const y = VIEW_H - 38 + ((i * 17) % 14);
      const grow = Math.min(1, Math.max(0, this.t * 1.5 - i * 0.03));
      if (grow <= 0) continue;
      r.rect(x, y - Math.round(grow * 4), 1, Math.round(grow * 4), '#3f7d3a');
      r.rect(x - 1, y - Math.round(grow * 4) - 2, 3, 2, flowers[i % flowers.length]);
    }
    const hop = Math.abs(Math.sin(this.t * 3)) * 20;
    r.sprite(characters().frame(FRAMES.hop_idle + GOLD), VIEW_W / 2, Math.round(VIEW_H - 40 - hop));
    label(r, 'TRUE ENDING', VIEW_W / 2, 24, { size: 16, color: '#ffd23f' });
    label(r, 'All 27 Sun Gems shine over Hopshire.', VIEW_W / 2, 48);
    label(r, 'Golden Hop unlocked!', VIEW_W / 2, 62, { color: '#ffd23f' });
    label(r, 'Enter: title', VIEW_W / 2, 84, { color: '#9be36b' });
  }

  meadow(r, bloom) {
    r.rect(0, VIEW_H - 40, VIEW_W, 40, WORLDS[1].ground);
    r.rect(0, VIEW_H - 40, VIEW_W, 4, WORLDS[1].top);
    r.circle(260, 40, 16 + bloom * 4, '#ffd23f');
    r.circle(260, 40, 22 + bloom * 6, 'rgba(255,210,63,0.25)');
  }
}

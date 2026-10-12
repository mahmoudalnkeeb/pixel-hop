import { Scene } from '../../vendor/h3-engine.min.js';
import { BACK, CONFIRM, LEFT, MENU_DOWN, MENU_UP, RIGHT, VIEW_H, VIEW_W } from '../config.js';
import { loadSave, writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { label } from './label.js';

const ROW = 12;

/**
 * A titled list of settings. Each row is `{ name, get?, change?(dir), open?, back? }`:
 * Left/Right (or Enter) calls `change`, Enter on `open` pushes another scene, Esc or a `back` row pops.
 * Changes are saved immediately (§9.6 "save when options change").
 */
export class ListScene extends Scene {
  /** Override: return the rows. `this.save` is loaded before this is called. */
  rows() {
    return [];
  }

  title() {
    return '';
  }

  footer() {
    return 'Left/Right change   Esc back';
  }

  enter() {
    this.save = loadSave();
    this.index = 0;
    this.items = this.rows();
  }

  resume() {
    this.save = loadSave();
    this.items = this.rows();
  }

  update(_dt, { input }) {
    const move = (input.justPressed(MENU_DOWN) ? 1 : 0) - (input.justPressed(MENU_UP) ? 1 : 0);
    if (move) {
      this.index = (this.index + move + this.items.length) % this.items.length;
      sfx('ui_move');
    }
    const row = this.items[this.index];
    const d = (input.justPressed(RIGHT) ? 1 : 0) - (input.justPressed(LEFT) ? 1 : 0);
    if (row.open && input.justPressed(CONFIRM)) {
      sfx('ui_confirm');
      this.game.scenes.push(row.open);
      return;
    }
    if ((d || input.justPressed(CONFIRM)) && row.change) {
      row.change(d || 1);
      writeSave(this.save);
      this.onChange?.(row);
      sfx(row.sound ?? 'ui_confirm');
    }
    if (input.justPressed(BACK) || (row.back && input.justPressed(CONFIRM))) {
      sfx('ui_back');
      this.game.scenes.pop(this.key);
    }
  }

  render(r) {
    if (this.game.scenes.current !== this) return; // a sub-menu is open on top
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.92)');
    label(r, this.title(), VIEW_W / 2, 14, { size: 16 });
    const top = 40;
    this.items.forEach((row, i) => {
      const y = top + i * ROW;
      const color = i === this.index ? '#ffd23f' : '#fff';
      label(r, row.name, 70, y, { align: 'left', color });
      if (row.get) label(r, `< ${row.get()} >`, 250, y, { align: 'right', color });
      else if (row.open) label(r, '>', 250, y, { align: 'right', color });
    });
    label(r, this.footer(), VIEW_W / 2, VIEW_H - 14, { color: '#aab' });
  }
}

/** Cycle `value` through `list` by `dir`. */
export const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

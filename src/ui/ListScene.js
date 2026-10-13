import { Scene } from '../../vendor/h3-engine.min.js';
import { BACK, CONFIRM, LEFT, MENU_DOWN, MENU_UP, RIGHT, VIEW_H, VIEW_W } from '../config.js';
import { loadSave, writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { textWidth } from './font.js';
import { label } from './label.js';
import { panel, pointer, selection } from './panel.js';

const ROW = 12;
const TOP = 40; // y of the first row

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
    return this.game.touch?.visible ? 'Tap a setting to change it' : 'Left/Right change   Esc back';
  }

  enter() {
    this.taps = true; // touch: tap a row to change or open it
    this.save = loadSave();
    this.index = 0;
    this.items = this.rows();
  }

  resume() {
    this.save = loadSave();
    this.items = this.rows();
  }

  update(_dt, { input }) {
    const tap = this.game.touch?.takeTap();
    if (tap) {
      this.tapRow(tap);
      return;
    }
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

  /** Tap a row: its value's left half steps back, anything else on the row steps forward or opens it. */
  tapRow(tap) {
    const i = Math.floor((tap.y - TOP + 2) / ROW);
    const row = this.items[i];
    if (!row || Math.abs(tap.x - VIEW_W / 2) > 100) return;
    this.index = i;
    if (row.back) {
      sfx('ui_back');
      this.game.scenes.pop(this.key);
    } else if (row.open) {
      sfx('ui_confirm');
      this.game.scenes.push(row.open);
    } else if (row.change) {
      const right = VIEW_W / 2 + 90;
      const left = row.get ? right - textWidth(`< ${row.get()} >`) : right;
      row.change(tap.x >= left && tap.x < (left + right) / 2 ? -1 : 1);
      writeSave(this.save);
      this.onChange?.(row);
      sfx(row.sound ?? 'ui_confirm');
    }
  }

  render(r) {
    if (this.game.scenes.current !== this) return; // a sub-menu is open on top
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.86)');
    label(r, this.title(), VIEW_W / 2, 14, { size: 16 });
    const left = Math.floor(VIEW_W / 2) - 100;
    panel(r, left, TOP - 6, 200, this.items.length * ROW + 9);
    this.items.forEach((row, i) => {
      const y = TOP + i * ROW;
      const selected = i === this.index;
      const color = selected ? '#ffd23f' : '#fff';
      if (selected) {
        selection(r, left + 2, y - 2, 196, ROW - 1);
        pointer(r, left + 2, y);
      }
      label(r, row.name, VIEW_W / 2 - 90, y, { align: 'left', color });
      if (row.get) label(r, `< ${row.get()} >`, VIEW_W / 2 + 90, y, { align: 'right', color });
      else if (row.open) label(r, '>', VIEW_W / 2 + 90, y, { align: 'right', color });
    });
    const footer = this.footer();
    const fw = textWidth(footer) + 12;
    panel(r, Math.floor(VIEW_W / 2 - fw / 2), VIEW_H - 18, fw, 14);
    label(r, footer, VIEW_W / 2, VIEW_H - 15, { color: '#aab' });
  }
}

/** Cycle `value` through `list` by `dir`. */
export const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

import { CONFIRM, MENU_DOWN, MENU_UP } from '../config.js';
import { sfx } from '../sfx.js';
import { label } from './label.js';

const LINE = 12;

/** Vertical text menu, driven by keyboard or by tapping an item. */
export class Menu {
  /** @param {{ text: string, value: string }[]} items */
  constructor(items) {
    this.items = items;
    this.index = 0;
    this.pos = null; // where it was last drawn, for hit-testing taps
  }

  /**
   * @param {{ x: number, y: number } | null} [tap] From `game.touch.takeTap()`.
   * @returns {string | null} The chosen item's value on confirm.
   */
  update({ input }, tap = null) {
    const hit = tap && this.pos ? Math.floor((tap.y - this.pos.y + 2) / LINE) : -1;
    if (hit >= 0 && hit < this.items.length && Math.abs(tap.x - this.pos.x) < 80) {
      this.index = hit;
      sfx('ui_confirm');
      return this.items[hit].value;
    }
    const move = (input.justPressed(MENU_DOWN) ? 1 : 0) - (input.justPressed(MENU_UP) ? 1 : 0);
    if (move !== 0) {
      this.index = (this.index + move + this.items.length) % this.items.length;
      sfx('ui_move');
    }
    if (input.justPressed(CONFIRM)) {
      sfx('ui_confirm');
      return this.items[this.index].value;
    }
    return null;
  }

  render(r, cx, y) {
    this.pos = { x: cx, y };
    for (let i = 0; i < this.items.length; i++) {
      const selected = i === this.index;
      const text = selected ? `> ${this.items[i].text} <` : this.items[i].text;
      label(r, text, cx, y + i * LINE, { color: selected ? '#ffd23f' : '#fff' });
    }
  }
}

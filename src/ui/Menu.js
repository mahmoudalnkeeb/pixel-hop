import { CONFIRM, MENU_DOWN, MENU_UP } from '../config.js';
import { sfx } from '../sfx.js';
import { label } from './label.js';

const LINE = 12;

/** Vertical text menu driven by keyboard. */
export class Menu {
  /** @param {{ text: string, value: string }[]} items */
  constructor(items) {
    this.items = items;
    this.index = 0;
  }

  /** @returns {string | null} The chosen item's value on confirm. */
  update({ input, audio }) {
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
    for (let i = 0; i < this.items.length; i++) {
      const selected = i === this.index;
      const text = selected ? `> ${this.items[i].text} <` : this.items[i].text;
      label(r, text, cx, y + i * LINE, { color: selected ? '#ffd23f' : '#fff' });
    }
  }
}

import { applyKeys, ACTION_NAMES, ACTIONS, defaultKeys, keyLabel, keysFor } from '../input/controls.js';
import { writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { label } from '../ui/label.js';
import { ListScene } from '../ui/ListScene.js';
import { VIEW_W } from '../config.js';

/**
 * Key remapping (§3.1, §9.5). Enter on an action, then press a key: it becomes that action's first key.
 * Jump keeps a second key so "either jump key" stays usable. Escape can't be bound (it's always Back).
 */
export class ControlsScene extends ListScene {
  title() {
    return 'CONTROLS';
  }

  footer() {
    return this.waiting ? 'Press a key...   (Esc cancels)' : 'Enter: rebind   Esc back';
  }

  rows() {
    const keys = (this.save.options.keys ??= {});
    const rows = Object.keys(ACTIONS).map((action) => ({
      name: ACTION_NAMES[action],
      get: () => (this.waiting === action ? '...' : keysFor(action).slice(0, 2).map(keyLabel).join(' / ')),
      change: (d) => {
        if (d === 1) this.listen(action, keys);
      },
    }));
    rows.push({
      name: 'Reset to defaults',
      change: () => {
        this.save.options.keys = {};
        applyKeys({});
      },
    });
    rows.push({ name: 'Back', back: true });
    return rows;
  }

  /** Bind the next key pressed to `action`; `update` reads it from the engine's `pressedCodes`. */
  listen(action, keys) {
    this.waiting = action;
    this.keys = keys;
  }

  bind(action, keys, code) {
    const current = keysFor(action);
    keys[action] = action === 'jump' ? [code, ...current.filter((c) => c !== code)].slice(0, 2) : [code];
    // A key can only do one thing: remove it from other actions.
    for (const other of Object.keys(ACTIONS)) {
      if (other === action) continue;
      const list = (keys[other] ?? defaultKeys(other)).filter((c) => c !== code);
      keys[other] = list.length ? list : defaultKeys(other).filter((c) => c !== code);
    }
    applyKeys(keys);
    writeSave(this.save);
    sfx('ui_confirm');
  }

  update(dt, ctx) {
    if (!this.waiting) {
      super.update(dt, ctx);
      return;
    }
    // Touch buttons feed fake codes into the same set; only a real key can be bound.
    const code = [...ctx.input.pressedCodes].find((c) => !c.startsWith('Touch'));
    if (!code) return;
    const action = this.waiting;
    this.waiting = null;
    if (code !== 'Escape') this.bind(action, this.keys, code);
  }

  render(r) {
    super.render(r);
    if (this.waiting) label(r, `Press a key for ${ACTION_NAMES[this.waiting]}`, VIEW_W / 2, 30, { color: '#9be36b' });
  }
}

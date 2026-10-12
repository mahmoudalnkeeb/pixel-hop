import { BACK, CONFIRM, DOWN, JUMP, LEFT, MENU_DOWN, MENU_UP, PAUSE, RIGHT } from '../config.js';

// Remappable actions (§3.1). Remapping replaces the action's key array in place, so every
// `input.isDown(JUMP)` in the game picks up the new keys without plumbing.
export const ACTIONS = { left: LEFT, right: RIGHT, down: DOWN, jump: JUMP, pause: PAUSE };
export const ACTION_NAMES = { left: 'Move left', right: 'Move right', down: 'Down (drop)', jump: 'Jump', pause: 'Pause' };

// Virtual codes sent by the on-screen touch buttons. They're always kept in the arrays, so touch keeps
// working whatever the keyboard mapping is.
export const TOUCH = { left: 'TouchLeft', right: 'TouchRight', up: 'TouchUp', down: 'TouchDown', a: 'TouchA', pause: 'TouchPause' };
const TOUCH_FOR = { left: TOUCH.left, right: TOUCH.right, down: TOUCH.down, jump: TOUCH.a, pause: TOUCH.pause };

const DEFAULTS = Object.fromEntries(Object.entries(ACTIONS).map(([k, arr]) => [k, [...arr]]));

const replace = (arr, codes) => {
  arr.length = 0;
  arr.push(...codes);
};

/** Apply saved bindings (`options.keys`), falling back to defaults. Touch codes are always included. */
export const applyKeys = (saved = {}) => {
  for (const [action, arr] of Object.entries(ACTIONS)) {
    const codes = Array.isArray(saved[action]) && saved[action].length ? saved[action] : DEFAULTS[action];
    replace(arr, [...codes, TOUCH_FOR[action]]);
  }
  // Menus: the d-pad navigates, A confirms, the pause button goes back.
  for (const [arr, code] of [[MENU_UP, TOUCH.up], [MENU_DOWN, TOUCH.down], [CONFIRM, TOUCH.a], [BACK, TOUCH.pause]]) {
    if (!arr.includes(code)) arr.push(code);
  }
};

/** Keyboard codes for an action, without the touch code. */
export const keysFor = (action) => ACTIONS[action].filter((c) => !c.startsWith('Touch'));

export const defaultKeys = (action) => [...DEFAULTS[action]];

/** Human-friendly key name: "KeyZ" → "Z", "ArrowLeft" → "Left". */
export const keyLabel = (code) =>
  code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Arrow/, '')
    .replace('Space', 'Space');

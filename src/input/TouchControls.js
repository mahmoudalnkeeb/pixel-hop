import { TOUCH } from './controls.js';

// Semi-transparent on-screen buttons (§9.4), in logical pixels. Shown automatically on the first touch.
const BUTTONS = [
  { code: TOUCH.left, x: 4, y: 132, w: 28, h: 28, glyph: 'left' },
  { code: TOUCH.right, x: 52, y: 132, w: 28, h: 28, glyph: 'right' },
  { code: TOUCH.up, x: 30, y: 108, w: 24, h: 22, glyph: 'up' },
  { code: TOUCH.down, x: 30, y: 158, w: 24, h: 20, glyph: 'down' },
  { code: TOUCH.a, x: 268, y: 128, w: 44, h: 44, glyph: 'A', round: true },
  { code: TOUCH.pause, x: 296, y: 18, w: 20, h: 16, glyph: 'pause' },
];

/**
 * Multi-touch virtual buttons. h3-engine's Input only follows the primary pointer, so this reads every
 * touch itself and feeds the engine through the public `input.keyDown` / `input.keyUp`.
 */
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.held = new Set();
    this._pt = { x: 0, y: 0 };
    const canvas = game.renderer.canvas;
    const onTouch = (e) => {
      e.preventDefault();
      this.visible = true;
      this.sync(e.touches);
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      canvas.addEventListener(type, onTouch, { passive: false });
    }
  }

  /** Press the buttons under current touches; release the rest. */
  sync(touches) {
    const now = new Set();
    for (const t of touches) {
      const p = this.game.renderer.toLogical(t.clientX, t.clientY, this._pt);
      for (const b of BUTTONS) {
        // A little slop around each button so thumbs don't slip off.
        if (p.x >= b.x - 4 && p.x < b.x + b.w + 4 && p.y >= b.y - 4 && p.y < b.y + b.h + 4) now.add(b.code);
      }
    }
    const input = this.game.input;
    for (const code of now) if (!this.held.has(code)) input.keyDown(code);
    for (const code of this.held) if (!now.has(code)) input.keyUp(code);
    this.held = now;
  }

  render(r) {
    if (!this.visible) return;
    for (const b of BUTTONS) {
      const on = this.held.has(b.code);
      const fill = on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      if (b.round) r.circle(cx, cy, b.w / 2, fill);
      else r.rect(b.x, b.y, b.w, b.h, fill);
      const ink = 'rgba(255,255,255,0.8)';
      if (b.glyph === 'left') r.poly([cx + 5, cy - 6, cx - 5, cy, cx + 5, cy + 6], ink);
      else if (b.glyph === 'right') r.poly([cx - 5, cy - 6, cx + 5, cy, cx - 5, cy + 6], ink);
      else if (b.glyph === 'up') r.poly([cx - 6, cy + 4, cx, cy - 5, cx + 6, cy + 4], ink);
      else if (b.glyph === 'down') r.poly([cx - 6, cy - 4, cx, cy + 5, cx + 6, cy - 4], ink);
      else if (b.glyph === 'pause') {
        r.rect(cx - 4, cy - 4, 3, 8, ink);
        r.rect(cx + 1, cy - 4, 3, 8, ink);
      } else r.text(b.glyph, cx, cy, { font: 'bold 16px monospace', color: ink, align: 'center', baseline: 'middle' });
    }
  }
}

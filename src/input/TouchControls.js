import { VIEW_H, VIEW_W } from '../config.js';
import { drawText } from '../ui/font.js';
import { label } from '../ui/label.js';
import { TOUCH } from './controls.js';

const STICK_SPLIT = 0.45; // the left 45% of the screen is the thumbstick, the rest is Jump
const STICK_RADIUS = 18; // logical px the knob travels before the stick follows the thumb
const DEAD_ZONE = 5;
const DOWN_ZONE = 10;
const TAP_TIME = 350; // ms; longer presses aren't taps
const TAP_SLOP = 8; // logical px a tap may wander
const TAP_FRESH = 250; // ms a tap waits for a scene to take it
const BUTTON = { w: 22, h: 16 }; // pause (playing, top-right) and back (menus, top-left)

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * Touch controls (§9.4), built for thumbs rather than precise buttons:
 * - Playing: the left of the screen is a floating thumbstick that appears where the thumb lands and
 *   follows it when dragged past its rim, so reversing is instant; pull down to drop through.
 *   Anywhere on the right is Jump. Pause is the button under the timer.
 * - Menus: scenes with `taps = true` read taps with `takeTap()` (tap an item to choose it); elsewhere
 *   a touch is Confirm. The top-left button is Back.
 * Each touch keeps the role it started with, so a thumb sliding across the split doesn't change job.
 * h3-engine's Input follows only the primary pointer, so this reads every touch itself and feeds the
 * engine through `input.keyDown` / `input.keyUp`.
 */
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.visible = coarse(); // phones and tablets show the controls before the first touch
    this.touches = new Map(); // touch id → { role, ox, oy, x, y, start }
    this.held = new Set();
    this.tap = null;
    this.triedFullscreen = false;
    this._pt = { x: 0, y: 0 };
    const canvas = game.renderer.canvas;
    canvas.addEventListener('touchstart', (e) => this._onStart(e), { passive: false });
    for (const type of ['touchmove', 'touchend', 'touchcancel']) {
      canvas.addEventListener(type, (e) => this._onChange(e), { passive: false });
    }
  }

  get playing() {
    return this.game.scenes.current?.key === 'play';
  }

  /** The latest tap in logical pixels, or null. Each tap is handed out once, and only while fresh. */
  takeTap() {
    const tap = this.tap;
    this.tap = null;
    return tap && performance.now() - tap.time < TAP_FRESH ? tap : null;
  }

  _onStart(e) {
    e.preventDefault();
    this.visible = true;
    for (const t of e.changedTouches) {
      const { x, y } = this.game.renderer.toLogical(t.clientX, t.clientY, this._pt);
      this.touches.set(t.identifier, { role: this._roleAt(x, y), ox: x, oy: y, x, y, start: performance.now() });
    }
    this._sync();
  }

  _onChange(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const touch = this.touches.get(t.identifier);
      if (!touch) continue;
      const { x, y } = this.game.renderer.toLogical(t.clientX, t.clientY, this._pt);
      touch.x = x;
      touch.y = y;
      if (touch.role === 'stick') this._follow(touch);
      if (e.type === 'touchmove') continue;
      this.touches.delete(t.identifier);
      const quick = performance.now() - touch.start < TAP_TIME && Math.hypot(x - touch.ox, y - touch.oy) < TAP_SLOP;
      if (e.type === 'touchend' && touch.role === 'tap' && quick) this.tap = { x, y, time: performance.now() };
    }
    if (e.type === 'touchend') this._goFullscreen();
    this._sync();
  }

  _roleAt(x, y) {
    if (this.playing) {
      if (x > VIEW_W - BUTTON.w - 12 && y > 12 && y < 20 + BUTTON.h + 8) return 'pause';
      return x < VIEW_W * STICK_SPLIT ? 'stick' : 'jump';
    }
    if (this._hasBack() && x < BUTTON.w + 12 && y < BUTTON.h + 12) return 'back';
    return this.game.scenes.current?.taps ? 'tap' : 'confirm';
  }

  _hasBack() {
    return this.game.scenes.current?.key !== 'title';
  }

  /** Pull the stick's centre along once the thumb passes its rim. */
  _follow(t) {
    const dx = t.x - t.ox;
    const dy = t.y - t.oy;
    const d = Math.hypot(dx, dy);
    if (d <= STICK_RADIUS) return;
    t.ox = t.x - (dx / d) * STICK_RADIUS;
    t.oy = t.y - (dy / d) * STICK_RADIUS;
  }

  /** Press the codes the current touches ask for; release the rest. */
  _sync() {
    const now = new Set();
    for (const t of this.touches.values()) {
      if (t.role === 'stick') {
        const dx = t.x - t.ox;
        const dy = t.y - t.oy;
        if (dx < -DEAD_ZONE) now.add(TOUCH.left);
        else if (dx > DEAD_ZONE) now.add(TOUCH.right);
        if (dy > DOWN_ZONE && dy > Math.abs(dx)) now.add(TOUCH.down);
      } else if (t.role === 'jump' || t.role === 'confirm') {
        now.add(TOUCH.a);
      } else if (t.role === 'pause' || t.role === 'back') {
        now.add(TOUCH.pause);
      }
    }
    const input = this.game.input;
    for (const code of now) if (!this.held.has(code)) input.keyDown(code);
    for (const code of this.held) if (!now.has(code)) input.keyUp(code);
    this.held = now;
  }

  /** Phones: hide the browser bars and hold landscape. Needs a user gesture, so it's tried on the first touch. */
  _goFullscreen() {
    if (this.triedFullscreen || !coarse()) return;
    this.triedFullscreen = true;
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {}); // refused (iOS Safari, settings): the game still fills the window
  }

  render(r) {
    if (!this.visible) return;
    if (innerHeight > innerWidth && coarse()) {
      this._renderRotateHint(r);
      return;
    }
    if (this.playing) this._renderPlay(r);
    else if (this._hasBack()) this._renderBack(r);
  }

  _renderPlay(r) {
    const stick = [...this.touches.values()].find((t) => t.role === 'stick');
    const base = stick ? { x: stick.ox, y: stick.oy } : { x: 40, y: VIEW_H - 40 };
    r.circle(base.x, base.y, STICK_RADIUS + 5, stick ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)');
    const knob = stick ?? base;
    r.circle(knob.x, knob.y, 9, stick ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)');

    const jumping = this.held.has(TOUCH.a);
    const jx = VIEW_W - 42;
    const jy = VIEW_H - 40;
    r.circle(jx, jy, 22, jumping ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.14)');
    drawText(r, 'A', jx, jy - 7, { color: '#ffffff', align: 'center', scale: 2 });

    const px = VIEW_W - BUTTON.w - 5;
    const py = 20;
    r.rect(px, py, BUTTON.w, BUTTON.h, this.held.has(TOUCH.pause) ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.18)');
    r.rect(px + 7, py + 4, 3, 8, 'rgba(255,255,255,0.85)');
    r.rect(px + 12, py + 4, 3, 8, 'rgba(255,255,255,0.85)');
  }

  _renderBack(r) {
    r.rect(5, 5, BUTTON.w, BUTTON.h, this.held.has(TOUCH.pause) ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.18)');
    r.poly([19, 8, 11, 13, 19, 18], 'rgba(255,255,255,0.85)');
  }

  _renderRotateHint(r) {
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.92)');
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2 - 14;
    r.rect(cx - 7, cy - 12, 14, 24, '#ffd23f'); // a phone...
    r.rect(cx - 5, cy - 9, 10, 17, '#1c2a3a');
    r.rect(cx + 14, cy - 2, 12, 2, '#fff'); // ...and a turn arrow
    r.poly([cx + 26, cy - 6, cx + 32, cy - 1, cx + 26, cy + 4], '#fff');
    label(r, 'Turn your phone sideways', cx, cy + 22);
  }
}

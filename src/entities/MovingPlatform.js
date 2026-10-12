import { Entity } from '../../vendor/h3-engine.min.js';
import { T } from '../config.js';
import { sfx } from '../sfx.js';

const THICKNESS = 6;

/**
 * Linear back-and-forth platform, solid on top only (§4.2). `dx`/`dy` hold this step's
 * movement so riders can be carried. Add platforms to the scene before the player so
 * they move first.
 */
export class MovingPlatform extends Entity {
  /** @param {{ x: number, y: number, w: number, dx?: number, dy?: number, speed?: number, wait?: number }} def Tiles, px/s, s. */
  constructor({ x, y, w, dx = 0, dy = 0, speed = 40, wait = 0.5 }) {
    super({ x: x * T, y: y * T, w: w * T, h: THICKNESS, z: 2, tags: ['platform'] });
    this.ax = x * T;
    this.ay = y * T;
    this.bx = (x + dx) * T;
    this.by = (y + dy) * T;
    this.speed = speed;
    this.waitTime = wait;
    this.wait = wait;
    this.toB = true;
    this.dx = 0;
    this.dy = 0;
  }

  update(dt, { audio }) {
    const px = this.pos.x;
    const py = this.pos.y;
    if (this.wait > 0) {
      this.wait -= dt;
    } else {
      const tx = this.toB ? this.bx : this.ax;
      const ty = this.toB ? this.by : this.ay;
      const ddx = tx - px;
      const ddy = ty - py;
      const d = Math.hypot(ddx, ddy);
      const step = this.speed * dt;
      if (d <= step) {
        this.pos.set(tx, ty);
        this.toB = !this.toB;
        this.wait = this.waitTime;
        if (this.onCamera()) sfx(audio, 'platform');
      } else {
        this.pos.x += (ddx / d) * step;
        this.pos.y += (ddy / d) * step;
      }
    }
    this.dx = this.pos.x - px;
    this.dy = this.pos.y - py;
  }

  onCamera() {
    const v = this.scene.camera.view;
    return this.pos.x + this.w > v.x && this.pos.x < v.x + v.w && this.pos.y + this.h > v.y && this.pos.y < v.y + v.h;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    r.rect(x, y, this.w, THICKNESS, '#9aa3b5');
    r.rect(x, y, this.w, 2, '#d6dbe6');
    r.rect(x, y + THICKNESS - 1, this.w, 1, '#555c6b');
    for (let i = 4; i < this.w; i += 16) r.rect(x + i, y + 2, 2, 2, '#555c6b');
  }
}

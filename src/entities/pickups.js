import { Entity } from '../../vendor/h3-engine.min.js';
import { T } from '../config.js';

/** Things Hop collects by touching (§4.4). The play scene calls `collect` and applies the effect by `kind`. */
class Pickup extends Entity {
  constructor(x, y, w, h, kind) {
    super({ x: x + (T - w) / 2, y: y + (T - h) / 2, w, h, z: 3, tags: ['pickup'] });
    this.kind = kind;
    this.t = Math.random() * 10;
  }

  update(dt) {
    this.t += dt;
  }
}

export class Coin extends Pickup {
  constructor(x, y) {
    super(x, y, 8, 10, 'coin');
  }

  render(r) {
    // Spin by narrowing the coin.
    const w = Math.max(2, Math.round(Math.abs(Math.cos(this.t * 4)) * 8));
    const x = Math.round(this.cx - w / 2);
    const y = Math.round(this.pos.y);
    r.rect(x, y, w, 10, '#ffd23f');
    if (w > 3) r.rect(x + 1, y + 1, 1, 8, '#fff6b0');
    r.rect(x, y + 9, w, 1, '#c99a12');
  }
}

export class Gem extends Pickup {
  /** @param {number} index 0–2, the gem's slot in the save file. */
  constructor(x, y, index) {
    super(x, y, 10, 12, 'gem');
    this.index = index;
    this.ghost = false;
  }

  render(r) {
    const cx = Math.round(this.cx);
    const cy = Math.round(this.cy + Math.sin(this.t * 3) * 1.5);
    if (this.ghost) r.alpha = 0.45; // already found on an earlier run
    r.poly([cx, cy - 6, cx + 5, cy, cx, cy + 6, cx - 5, cy], '#ffb627');
    r.poly([cx, cy - 6, cx + 5, cy, cx, cy], '#ffe08a');
    if (Math.sin(this.t * 5) > 0.8) r.rect(cx - 1, cy - 9, 2, 2, '#fff');
    r.alpha = 1;
  }
}

export class Heart extends Pickup {
  constructor(x, y) {
    super(x, y, 10, 9, 'heart');
  }

  render(r) {
    drawHeart(r, Math.round(this.pos.x), Math.round(this.pos.y + Math.sin(this.t * 3)), '#ff5e7a');
  }
}

/** 10×9 pixel heart. */
export const drawHeart = (r, x, y, color) => {
  r.rect(x + 1, y, 3, 1, color);
  r.rect(x + 6, y, 3, 1, color);
  r.rect(x, y + 1, 10, 3, color);
  r.rect(x + 1, y + 4, 8, 2, color);
  r.rect(x + 3, y + 6, 4, 2, color);
  r.rect(x + 4, y + 8, 2, 1, color);
};

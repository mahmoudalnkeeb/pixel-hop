import { Entity } from '../../vendor/h3-engine.min.js';
import { characters, PICKUP_FRAMES } from '../art/characters.js';
import { T } from '../config.js';

const GHOST = { alpha: 0.45 };

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
    const spin = Math.floor(this.t * 8) % 4;
    r.sprite(characters().frame(PICKUP_FRAMES.coin + spin), Math.round(this.cx), Math.round(this.pos.y + this.h + 1));
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
    const bottom = Math.round(this.pos.y + this.h + 1 + Math.sin(this.t * 3) * 1.5);
    // Already found on an earlier run: a faint ghost (§4.4).
    r.sprite(characters().frame(PICKUP_FRAMES.gem), cx, bottom, this.ghost ? GHOST : undefined);
    if (Math.sin(this.t * 5) > 0.8) {
      // Twinkle: a small cross above the gem.
      r.rect(cx + 2, bottom - 16, 1, 3, '#fff');
      r.rect(cx + 1, bottom - 15, 3, 1, '#fff');
    }
  }
}

export class Heart extends Pickup {
  constructor(x, y) {
    super(x, y, 10, 9, 'heart');
  }

  render(r) {
    r.sprite(characters().frame(PICKUP_FRAMES.heart), Math.round(this.cx), Math.round(this.pos.y + this.h + 2 + Math.sin(this.t * 3)));
  }
}

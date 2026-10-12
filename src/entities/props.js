import { Entity } from '../../vendor/h3-engine.min.js';
import { T } from '../config.js';
import { label } from '../ui/label.js';

/** Fixed launch at SPRING_SPEED; holding jump doesn't change the height (§4.2). */
export class Spring extends Entity {
  constructor(x, y) {
    super({ x: x + 1, y: y + 8, w: 14, h: 8, z: 3, tags: ['spring'] });
    this.squish = 0;
  }

  update(dt) {
    if (this.squish > 0) this.squish -= dt;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const squished = this.squish > 0;
    r.rect(x + 1, y + 6, 12, 2, '#555c6b');
    if (!squished) r.rect(x + 4, y + 3, 6, 3, '#9aa3b5');
    r.rect(x, y + (squished ? 3 : 0), 14, 3, '#ff5e5b');
  }
}

/** Lantern. Lights up on touch and becomes the respawn point (§4.2). */
export class Checkpoint extends Entity {
  constructor(x, y) {
    super({ x: x + 3, y: y - T, w: 10, h: 2 * T, z: 2, tags: ['checkpoint'] });
    this.lit = false;
    this.spawnX = x + 2;
    this.spawnY = y + 2;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    r.rect(x + 4, y + 8, 2, 24, '#5a4a3a');
    r.rect(x + 1, y + 4, 8, 2, '#5a4a3a');
    const glow = this.lit ? (Math.sin(this.t * 6) > 0 ? '#ffe27a' : '#ffd23f') : '#6b6b7a';
    if (this.lit) r.circle(x + 5, y + 11, 8, 'rgba(255,220,120,0.25)');
    r.rect(x + 1, y + 6, 8, 9, '#3a3040');
    r.rect(x + 2, y + 7, 6, 7, glow);
  }
}

export class Flag extends Entity {
  constructor(x, y) {
    super({ x: x + 6, y: y - 2 * T, w: 4, h: 3 * T, z: 2, tags: ['flag'] });
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    r.rect(x + 1, y, 2, 3 * T, '#e8e8f0');
    r.circle(x + 2, y, 2, '#ffd23f');
    const wave = Math.round(Math.sin(this.t * 6));
    r.poly([x + 3, y + 3, x + 16, y + 7 + wave, x + 3, y + 12], '#ff5e5b');
  }
}

/** A post with a hint that appears when Hop is near. */
export class Sign extends Entity {
  constructor(x, y, text) {
    super({ x: x + 2, y: y + 4, w: 12, h: 12, z: 1, tags: ['sign'] });
    this.text = text;
    this.debug = false;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    r.rect(x + 5, y + 6, 2, 6, '#7a5530');
    r.rect(x, y, 12, 7, '#c08a4b');
    r.rect(x + 2, y + 2, 8, 1, '#7a5530');
    r.rect(x + 2, y + 4, 6, 1, '#7a5530');
    const p = this.scene.player;
    if (p && Math.abs(p.cx - this.cx) < 2 * T && Math.abs(p.cy - this.cy) < 2 * T) {
      label(r, this.text, Math.round(this.cx), y - 14);
    }
  }
}

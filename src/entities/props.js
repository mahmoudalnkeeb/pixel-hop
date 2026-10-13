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
    const top = y + (squished ? 4 : 0);
    // Base plate.
    r.rect(x, y + 6, 14, 2, '#2b2b35');
    r.rect(x + 1, y + 6, 12, 1, '#6b7280');
    // Coil: alternating rungs between the pad and the base.
    for (let cy = top + 3, i = 0; cy < y + 6; cy++, i++) r.rect(x + (i % 2 ? 4 : 3), cy, 7, 1, i % 2 ? '#6b7280' : '#c9d0dc');
    // Pad, outlined, with a highlight.
    r.rect(x, top, 14, 3, '#7a1f2a');
    r.rect(x + 1, top, 12, 2, '#ff5e5b');
    r.rect(x + 2, top, 5, 1, '#ffb3ad');
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
    // Post with a darker edge, and a little foot.
    r.rect(x + 4, y + 14, 3, 18, '#3a2c20');
    r.rect(x + 4, y + 14, 2, 18, '#7a5a3a');
    r.rect(x + 2, y + 30, 7, 2, '#3a2c20');
    if (this.lit) {
      const pulse = Math.sin(this.t * 6) * 0.05;
      r.circle(x + 5, y + 10, 11, `rgba(255,214,110,${0.14 + pulse})`);
      r.circle(x + 5, y + 10, 7, `rgba(255,230,150,${0.22 + pulse})`);
    }
    // Lantern: roof, cage, glass, base.
    r.rect(x + 2, y + 1, 7, 2, '#2b2230');
    r.rect(x + 4, y, 3, 1, '#2b2230');
    r.rect(x + 1, y + 3, 9, 11, '#2b2230');
    r.rect(x + 2, y + 4, 7, 9, this.lit ? '#ffd23f' : '#4a4658');
    r.rect(x + 3, y + 5, 2, 7, this.lit ? '#fff3b0' : '#5e5a70'); // glass shine
    if (this.lit) r.rect(x + 5, y + 7 + (Math.sin(this.t * 9) > 0 ? 0 : 1), 2, 3, '#ff8a2a'); // flame
    r.rect(x + 5, y + 4, 1, 9, '#2b2230'); // cage bar
    r.rect(x + 2, y + 13, 7, 1, '#2b2230');
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
    // Pole with an outline and a gold ball.
    r.rect(x, y + 1, 4, 3 * T - 1, '#3a3a48');
    r.rect(x + 1, y + 1, 2, 3 * T - 1, '#e8e8f0');
    r.rect(x + 1, y + 1, 1, 3 * T - 1, '#ffffff');
    r.rect(x - 1, y - 3, 6, 5, '#7a5200');
    r.rect(x, y - 2, 4, 3, '#ffd23f');
    r.rect(x, y - 2, 2, 1, '#fff6b0');
    // Pennant: one column at a time, each shifted by the wave, so the cloth ripples crisply.
    for (let i = 0; i < 14; i++) {
      const h = Math.max(1, Math.round(10 - i * 0.65));
      const top = y + 3 + Math.round((10 - h) / 2 + Math.sin(this.t * 6 - i * 0.5) * (i / 14) * 1.5);
      r.rect(x + 4 + i, top - 1, 1, h + 2, '#7a1f2a');
      r.rect(x + 4 + i, top, 1, h, i % 4 < 2 ? '#ff5e5b' : '#f04a4a');
      if (i > 2 && i < 8) r.rect(x + 4 + i, top + Math.floor(h / 2), 1, 1, '#ffd23f'); // gold stripe
    }
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
    r.rect(x + 4, y + 6, 4, 6, '#3a2616');
    r.rect(x + 5, y + 6, 2, 6, '#8a5f35');
    r.rect(x - 1, y - 1, 14, 9, '#3a2616');
    r.rect(x, y, 12, 7, '#c08a4b');
    r.rect(x, y, 12, 1, '#e8b678');
    r.rect(x + 2, y + 2, 8, 1, '#7a5530'); // writing
    r.rect(x + 2, y + 4, 6, 1, '#7a5530');
    r.rect(x + 9, y + 5, 2, 1, '#a8774a'); // grain
    const p = this.scene.player;
    if (p && Math.abs(p.cx - this.cx) < 2 * T && Math.abs(p.cy - this.cy) < 2 * T) {
      label(r, this.text, Math.round(this.cx), y - 14);
    }
  }
}

/** Royal banner hanging from the ceiling (decoration, level 10). */
export class Banner extends Entity {
  constructor(x, y) {
    super({ x: x + 2, y, w: 12, h: 2 * T, z: -1, tags: ['decor'] });
    this.debug = false;
    this.t = Math.random() * 10;
  }

  update(dt) {
    this.t += dt;
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const sway = Math.round(Math.sin(this.t * 1.5));
    r.rect(x - 1, y, 14, 2, '#c99a12');
    r.rect(x, y + 2, 12, 24, '#a3243a');
    r.rect(x + 1, y + 2, 1, 24, '#c8384f');
    r.poly([x, y + 26, x + 12, y + 26, x + 6 + sway, y + 31], '#a3243a');
    // Gold crown emblem.
    r.rect(x + 3, y + 10, 6, 3, '#ffd23f');
    r.rect(x + 3, y + 8, 1, 2, '#ffd23f');
    r.rect(x + 5, y + 7, 2, 3, '#ffd23f');
    r.rect(x + 8, y + 8, 1, 2, '#ffd23f');
  }
}

import { Entity } from '../../vendor/h3-engine.min.js';
import { backdrop, LAYER_W, PAD } from '../art/backdrops.js';
import { MAX_VIEW_H, MAX_VIEW_W, VIEW_H, VIEW_W } from '../config.js';
import { hash2 } from '../art/paint.js';

const VERTICAL = 0.5; // layers move vertically at half their horizontal parallax
const AMBIENCE_COUNT = { pollen: 14, firefly: 18, mote: 24, petal: 16, rain: 70, ember: 16 };
const FLASH_TIME = 0.35;

const mod = (a, n) => ((a % n) + n) % n;

/**
 * Sky and parallax layers (§7). The sky is fixed to the screen; each layer scrolls at `f` × the
 * camera horizontally and half that vertically, so climbing reveals more sky. Ambient particles
 * drift at their own depth. Drawn pixel-aligned with the camera's rounded transform.
 */
export class Backdrop extends Entity {
  /** @param {number | string} world World number, or a named backdrop such as 'throne'. */
  constructor(world) {
    super({ z: -10, tags: ['backdrop'] });
    this.debug = false;
    this.world = world;
    this.t = 0;
    this.flash = 0;
    this.nextFlash = 3;
    this.particles = null; // created on first update, once the kind is known
  }

  update(dt) {
    this.t += dt;
    const art = backdrop(this.world);
    if (!this.particles) this.particles = this._spawn(art.ambience);
    for (const p of this.particles) this._move(p, art.ambience, dt);
    if (art.lightning) {
      this.flash = Math.max(0, this.flash - dt);
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = FLASH_TIME;
        this.nextFlash = 4 + Math.random() * 6;
      }
    }
  }

  _spawn(kind) {
    return Array.from({ length: AMBIENCE_COUNT[kind] ?? 0 }, (_, i) => ({
      x: hash2(i, 1) * MAX_VIEW_W,
      y: hash2(1, i) * MAX_VIEW_H,
      f: 0.6 + hash2(i, 2) * 0.35, // depth: how much it follows the camera
      phase: hash2(i, 3) * 6.283,
      speed: 0.6 + hash2(i, 4) * 0.8,
    }));
  }

  _move(p, kind, dt) {
    if (kind === 'pollen') {
      p.x += 8 * p.speed * dt;
      p.y += Math.sin(this.t * 1.5 + p.phase) * 6 * dt;
    } else if (kind === 'firefly') {
      p.x += Math.cos(this.t * 0.7 * p.speed + p.phase) * 10 * dt;
      p.y += Math.sin(this.t * 0.9 * p.speed + p.phase * 2) * 8 * dt;
    } else if (kind === 'mote') {
      p.y -= 4 * p.speed * dt;
      p.x += Math.sin(this.t + p.phase) * 3 * dt;
    } else if (kind === 'petal') {
      p.x -= 14 * p.speed * dt;
      p.y += 10 * p.speed * dt;
    } else if (kind === 'rain') {
      p.x -= 50 * dt;
      p.y += 240 * p.speed * dt;
    } else if (kind === 'ember') {
      p.y -= 12 * p.speed * dt;
      p.x += Math.sin(this.t * 2 + p.phase) * 5 * dt;
    }
  }

  render(r) {
    const cam = this.scene.camera;
    const view = cam.view;
    const art = backdrop(this.world);
    // World position of the screen's top-left, matching Camera#apply with roundPixels.
    const ox = -Math.round(-(cam.x + cam.shakeX)) - VIEW_W / 2;
    const oy = -Math.round(-(cam.y + cam.shakeY)) - VIEW_H / 2;
    // How far the camera is above the lowest it can go; layers sink by a share of this.
    const climb = Math.max(0, this.scene.level.h - VIEW_H - view.y);

    r.image(art.sky, ox, oy);
    if (this.flash > 0) r.rect(ox, oy, VIEW_W, VIEW_H, `rgba(220,210,255,${(this.flash / FLASH_TIME) * 0.45})`);
    for (const l of art.layers) {
      const sink = Math.min(PAD, Math.round(climb * l.f * VERTICAL));
      const scroll = mod(Math.round(view.x * l.f + this.t * (l.drift ?? 0)), LAYER_W);
      for (let x = -scroll; x < VIEW_W; x += LAYER_W) r.image(l.canvas, ox + x, oy, { sy: PAD - sink, sh: VIEW_H });
    }
    if (this.particles) this._drawParticles(r, art.ambience, ox, oy, view);
  }

  _drawParticles(r, kind, ox, oy, view) {
    // Particles wrap inside a box a little larger than the view.
    const boxW = VIEW_W + 32;
    const boxH = VIEW_H + 32;
    for (const p of this.particles) {
      const x = ox + Math.round(mod(p.x - view.x * p.f, boxW)) - 16;
      const y = oy + Math.round(mod(p.y - view.y * p.f, boxH)) - 16;
      if (kind === 'pollen') {
        r.rect(x, y, 1, 1, 'rgba(255,252,220,0.8)');
      } else if (kind === 'firefly') {
        const on = Math.sin(this.t * 2 * p.speed + p.phase);
        if (on < -0.2) continue;
        r.rect(x - 1, y - 1, 3, 3, `rgba(220,255,120,${0.15 * on + 0.05})`);
        r.rect(x, y, 1, 1, '#eaff9a');
      } else if (kind === 'mote') {
        const twinkle = Math.sin(this.t * 3 + p.phase) > 0.92;
        r.rect(x, y, 1, 1, twinkle ? '#e6fbff' : 'rgba(170,160,255,0.45)');
      } else if (kind === 'petal') {
        r.rect(x, y, Math.sin(this.t * 4 + p.phase) > 0 ? 2 : 1, 1, 'rgba(255,190,210,0.85)');
      } else if (kind === 'rain') {
        for (let k = 0; k < 3; k++) r.rect(x - k, y + k * 2, 1, 2, 'rgba(160,170,230,0.35)');
      } else if (kind === 'ember') {
        r.rect(x, y, 1, 1, Math.sin(this.t * 5 + p.phase) > 0 ? '#ffb347' : 'rgba(255,120,40,0.6)');
      }
    }
  }
}

import { Entity } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { TILE, tiles } from '../art/tiles.js';
import {
  ACORN_INTERVAL, ACORN_SPEED, CRUMBLE_FADE, CRUMBLE_RESPAWN, CRUMBLE_SHAKE, GRAVITY, MAX_FALL, SWITCH_COOLDOWN, T,
  VIEW_W,
} from '../config.js';
import { sfx } from '../sfx.js';
import { Enemy } from './Enemy.js';

/** Shakes 0.5 s after being stood on, falls, respawns after 3 s with a 0.2 s fade-in (§4.2). */
export class CrumbleBlock extends Entity {
  constructor(x, y, world) {
    super({ x, y, w: T, h: T, z: 1, tags: ['crumble'] });
    this.world = world;
    this.homeY = y;
    this.state = 'idle'; // idle | shake | fall | fade
    this.t = 0;
    this.solid = true;
  }

  update(dt) {
    const p = this.scene.player;
    if (this.state === 'idle') {
      if (p.groundSolid === this && p.onGround) {
        this.state = 'shake';
        this.t = CRUMBLE_SHAKE;
        sfx('crumble');
      }
    } else if (this.state === 'shake') {
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'fall';
        this.solid = false;
        this.vel.y = 0;
        this.t = CRUMBLE_RESPAWN;
      }
    } else if (this.state === 'fall') {
      this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
      this.pos.y += this.vel.y * dt;
      this.t -= dt;
      // Don't reappear inside Hop.
      const blocked = p.pos.x < this.pos.x + T && p.pos.x + p.w > this.pos.x && p.pos.y < this.homeY + T && p.pos.y + p.h > this.homeY;
      if (this.t <= 0 && !blocked) {
        this.pos.y = this.homeY;
        this.vel.y = 0;
        this.state = 'fade';
        this.t = CRUMBLE_FADE;
        this.solid = true;
      }
    } else if (this.state === 'fade') {
      this.t -= dt;
      if (this.t <= 0) this.state = 'idle';
    }
  }

  /** Back to its first state (used when Hop respawns). */
  reset() {
    this.pos.y = this.homeY;
    this.vel.y = 0;
    this.state = 'idle';
    this.solid = true;
  }

  render(r) {
    if (this.state === 'fall' && this.pos.y > this.homeY + 12 * T) return;
    const jitter = this.state === 'shake' ? Math.round(Math.sin(this.t * 80)) : 0;
    const alpha = this.state === 'fade' ? 1 - this.t / CRUMBLE_FADE : this.state === 'fall' ? 0.8 : 1;
    r.sprite(tiles(this.world).frame(TILE.crumble), Math.round(this.pos.x) + jitter, Math.round(this.pos.y), { alpha });
  }
}

/** Hit from below or stomped: swaps every red and blue block in the level (§4.2). */
export class Switch extends Entity {
  constructor(x, y, world) {
    super({ x, y, w: T, h: T, z: 1, tags: ['switch'] });
    this.world = world;
    this.solid = true;
    this.cooldown = 0;
    this.squish = 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.squish > 0) this.squish -= dt;
  }

  bump() {
    if (this.cooldown > 0) return;
    this.cooldown = SWITCH_COOLDOWN;
    this.squish = 0.12;
    this.scene.toggleSwitchBlocks();
  }

  render(r) {
    const lift = this.squish > 0 ? -2 : 0;
    r.sprite(tiles(this.world).frame(TILE.switchBlock), Math.round(this.pos.x), Math.round(this.pos.y) + lift);
  }
}

/** Stompable acorn: flies straight at 90 px/s and disappears on walls (§4.3). Pooled. */
export class Acorn extends Enemy {
  constructor() {
    super({ w: 10, h: 10 }, { score: 0 });
    this.debug = true;
  }

  fire(x, y, dir, pool) {
    this.pos.set(x - this.w / 2, y - this.h / 2);
    this.vel.set(dir * ACORN_SPEED, 0);
    this.pool = pool;
    this.spin = 0;
    return this;
  }

  update(dt) {
    super.update(dt);
    this.spin += dt * 10 * Math.sign(this.vel.x);
    const level = this.scene.level;
    const ahead = this.vel.x > 0 ? this.pos.x + this.w : this.pos.x;
    const v = this.scene.camera.view;
    const far = this.pos.x < v.x - VIEW_W || this.pos.x > v.x + v.w + VIEW_W;
    if (level.isSolid(Math.floor(ahead / T), Math.floor(this.cy / T)) || far) this.onStomp();
  }

  onStomp() {
    if (this.dead) return true;
    this.destroy();
    this.pool.release(this);
    return true;
  }

  render(r) {
    r.sprite(characters().frame(FRAMES.acorn), Math.round(this.cx), Math.round(this.pos.y + this.h + 1), { rotation: this.spin * 0.2 });
  }
}

/** Fires acorns on a fixed rhythm while within a screen of the camera (§4.2, level 8). */
export class Cannon extends Entity {
  constructor(x, y, dir, acorns) {
    super({ x, y, w: T, h: T, z: 1, tags: ['cannon'] });
    this.debug = false;
    this.dir = dir;
    this.acorns = acorns;
    // Stagger neighbouring cannons so their acorns don't all fly at once.
    this.timer = ACORN_INTERVAL * (0.3 + ((x / T) % 5) / 7);
    this.recoil = 0;
  }

  update(dt) {
    if (this.recoil > 0) this.recoil -= dt;
    const v = this.scene.camera.view;
    if (this.pos.x < v.x - VIEW_W || this.pos.x > v.x + v.w + VIEW_W) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = ACORN_INTERVAL;
    this.recoil = 0.15;
    const muzzle = this.dir > 0 ? this.pos.x + T + 5 : this.pos.x - 5;
    this.scene.add(this.acorns.get().fire(muzzle, this.pos.y + 8, this.dir, this.acorns));
    const p = this.scene.player;
    if (Math.abs(p.cx - this.cx) < VIEW_W) sfx('cannon', { volume: 1 - Math.abs(p.cx - this.cx) / (1.5 * VIEW_W) });
  }

  render(r) {
    if (this.recoil <= 0) return; // the tile itself is drawn by the level
    r.rect(Math.round(this.dir > 0 ? this.pos.x + T : this.pos.x - 3), Math.round(this.pos.y + 5), 3, 6, '#fff6b0');
  }
}

/** A glowing cave crystal: decoration and a light source for the darkness overlay (§4.2). */
export class Crystal extends Entity {
  constructor(x, y) {
    super({ x, y, w: T, h: T, z: 1, tags: ['light'] });
    this.debug = false;
    this.t = Math.random() * 10;
  }

  update(dt) {
    this.t += dt;
  }

  render(r) {
    r.circle(this.cx, this.cy + 2, 9 + Math.sin(this.t * 2), 'rgba(111,227,255,0.18)');
    r.sprite(characters().frame(FRAMES.crystal), Math.round(this.cx), Math.round(this.pos.y + T));
  }
}

/**
 * Wind zone (§4.2, level 7). Horizontal wind (`dir` ±1) drifts Hop; `dir: "up"` is an updraft.
 * Leaves show direction and strength.
 */
export class WindZone extends Entity {
  /** @param {{ x: number, y: number, w: number, h: number, force: number, dir: number | 'up' }} def Tiles. */
  constructor({ x, y, w, h, force, dir }) {
    super({ x: x * T, y: y * T, w: w * T, h: h * T, z: 2, tags: ['wind'] });
    this.debug = false;
    this.force = force;
    this.up = dir === 'up';
    this.dir = this.up ? 0 : Math.sign(dir);
    this.leaves = Array.from({ length: Math.max(4, Math.round((w * h) / 6)) }, (_, i) => ({
      x: (i * 37) % (w * T),
      y: (i * 53) % (h * T),
      phase: i,
    }));
  }

  contains(e) {
    return e.pos.x + e.w > this.pos.x && e.pos.x < this.pos.x + this.w && e.pos.y + e.h > this.pos.y && e.pos.y < this.pos.y + this.h;
  }

  update(dt) {
    const speed = this.force * 0.4;
    for (const leaf of this.leaves) {
      leaf.phase += dt * 3;
      if (this.up) leaf.y = (leaf.y - speed * dt + this.h) % this.h;
      else leaf.x = (leaf.x + this.dir * speed * dt + this.w) % this.w;
    }
  }

  render(r) {
    const v = this.scene.camera.view;
    if (this.pos.x > v.x + v.w || this.pos.x + this.w < v.x) return;
    for (const leaf of this.leaves) {
      const wob = Math.sin(leaf.phase) * 2;
      const x = Math.round(this.pos.x + leaf.x + (this.up ? wob : 0));
      const y = Math.round(this.pos.y + leaf.y + (this.up ? 0 : wob));
      r.rect(x, y, this.up ? 1 : 3, this.up ? 3 : 1, 'rgba(255,255,255,0.55)');
      r.rect(x + (this.up ? 0 : this.dir), y + (this.up ? -1 : 0), 1, 1, '#9be36b');
    }
  }
}

/**
 * Rising thornwater (§4.2, level 9). Starts when Hop passes `trigger`, rises at `speed` px/s until
 * `stopRow`, and resets when Hop respawns. Touching it is fatal.
 */
export class Thornwater extends Entity {
  /** @param {{ x: number, w: number, trigger: number, startRow: number, stopRow: number, speed: number }} def Tiles. */
  constructor({ x, w, trigger, startRow, stopRow, speed }, levelH) {
    // Drawn behind the tiles, so water that starts inside a floor only shows once it rises into open air.
    super({ x: x * T, y: startRow * T, w: w * T, h: levelH, z: -1, tags: ['thornwater'] });
    this.debug = false;
    this.trigger = trigger * T;
    this.startY = startRow * T;
    this.stopY = stopRow * T;
    this.speed = speed;
    this.rising = false;
    this.t = 0;
    this.sfxTimer = 0;
  }

  reset() {
    this.pos.y = this.startY;
    this.rising = false;
  }

  update(dt) {
    this.t += dt;
    const p = this.scene.player;
    const inside = p.cx > this.pos.x && p.cx < this.pos.x + this.w;
    if (!this.rising && inside && p.cx > this.trigger && p.cy < this.startY) this.rising = true;
    if (this.rising && this.pos.y > this.stopY) this.pos.y = Math.max(this.stopY, this.pos.y - this.speed * dt);
    if (this.rising && inside) {
      this.sfxTimer -= dt;
      if (this.sfxTimer <= 0) {
        // Bubbling gets louder as the gap closes (§8.4).
        const gap = Math.max(0, this.pos.y - (p.pos.y + p.h));
        sfx('thornwater', { volume: Math.max(0.2, 1 - gap / 160) });
        this.sfxTimer = 0.35;
      }
    }
    if (inside && p.state === 'play' && p.pos.y + p.h > this.pos.y + 4) p.drown();
  }

  render(r) {
    const v = this.scene.camera.view;
    const top = Math.round(this.pos.y);
    const bottom = Math.min(this.pos.y + this.h, v.y + v.h + 4);
    if (top > bottom) return;
    r.rect(this.pos.x, top, this.w, bottom - top, 'rgba(70,20,60,0.85)');
    // Thorny surface: grey spikes with red tips (§7 hazard language).
    for (let x = this.pos.x; x < this.pos.x + this.w; x += 8) {
      const off = Math.round(Math.sin(this.t * 4 + x * 0.3) * 1.5);
      r.poly([x, top + 3, x + 4, top - 4 + off, x + 8, top + 3], '#dcdce6');
      r.rect(x + 3, top - 4 + off, 2, 2, '#ff3b3b');
    }
    r.rect(this.pos.x, top + 3, this.w, 2, '#a03a8a');
  }
}

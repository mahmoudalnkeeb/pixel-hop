import { Entity } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import {
  BAT_AMPLITUDE, BAT_PERIOD, BAT_SPEED, BAT_WAKE_RANGE, CULL_MARGIN, DROPPER_GRAVITY, DROPPER_TELL, GRAVITY, HOPPER_VX,
  HOPPER_VY, KNIGHT_SPEED, KNIGHT_SPEED_BARE, MAX_FALL, PUFFER_EVERY, PUFFER_RANGE, PUFFER_TELL, SCORE_DROPPER_DODGED,
  SLIME_SPEED, SPORE_SPEED, T, THORNBACK_SPEED, VIEW_W,
} from '../config.js';
import { sfx } from '../sfx.js';

/** Base for everything tagged `enemy` (§4.3). Enemies only act inside the camera view + 2 tiles. */
export class Enemy extends Entity {
  constructor(opts, { score = 100, stompable = true } = {}) {
    super({ ...opts, z: 4, tags: stompable ? ['enemy', 'stompable'] : ['enemy'] });
    this.score = score;
  }

  /** Inside the camera view, expanded by CULL_MARGIN. */
  get onCamera() {
    const v = this.scene.camera.view;
    return (
      this.pos.x + this.w > v.x - CULL_MARGIN &&
      this.pos.x < v.x + v.w + CULL_MARGIN &&
      this.pos.y + this.h > v.y - CULL_MARGIN &&
      this.pos.y < v.y + v.h + CULL_MARGIN
    );
  }

  /** Enemy sounds fade with distance and stop beyond 1.5 screens (§8.5). */
  soundVolume() {
    const p = this.scene.player;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    return Math.max(0, 1 - d / (1.5 * VIEW_W));
  }

  /** Called when Hop stomps it. Return false to survive (e.g. armoured enemies). */
  onStomp() {
    this.destroy();
    return true;
  }
}

/** Green blob. Walks at 30 px/s and turns at walls and ledges. */
export class Slime extends Enemy {
  constructor(x, y) {
    super({ x: x + 2, y: y + 6, w: 12, h: 10 }, { score: 100 });
    this.dir = -1;
    this.t = Math.random() * 10;
    this.airborne = false;
  }

  /** Thrown in an arc (King Gloop's belch); walks once it lands. */
  launch(vx, vy) {
    this.vel.set(vx, vy);
    this.dir = vx < 0 ? -1 : 1;
    this.airborne = true;
    return this;
  }

  update(dt) {
    if (!this.onCamera) return;
    const level = this.scene.level;
    this.t += dt;
    if (this.airborne) {
      this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
      if (level.moveAndCollide(this, dt).ground) this.airborne = false;
      return;
    }
    this.vel.x = this.dir * SLIME_SPEED;
    this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
    const hit = level.moveAndCollide(this, dt);
    if (hit.wall || (hit.ground && !level.groundAhead(this, this.dir))) this.dir = -this.dir;
    if (this.pos.y > level.h + T) this.destroy();
  }

  render(r) {
    // Rounded top = stompable (§7). Wobbles as it walks.
    const wob = Math.sin(this.t * 10) * 0.06;
    r.sprite(characters().frame(FRAMES.slime), Math.round(this.cx), Math.round(this.pos.y + this.h), {
      w: Math.round(16 * (1 + wob)),
      h: Math.round(16 * (1 - wob)),
      flipX: this.dir < 0,
    });
  }
}

const HOP_EVERY = 1.5;
const HOP_TELL = 0.3;
const HOP_RANGE = 8 * T;

/** Blue blob. Every 1.5 s hops toward Hop (vx 60, vy 260) when within 8 tiles, squashing 0.3 s before (§4.3). */
export class Hopper extends Enemy {
  constructor(x, y) {
    super({ x: x + 2, y: y + 6, w: 12, h: 10 }, { score: 150 });
    this.dir = -1;
    this.timer = HOP_EVERY;
    this.onGround = false;
  }

  update(dt) {
    if (!this.onCamera) return;
    const level = this.scene.level;
    const player = this.scene.player;
    if (this.onGround) {
      this.vel.x = 0;
      const dx = player.cx - this.cx;
      if (Math.abs(dx) < HOP_RANGE && Math.abs(player.cy - this.cy) < HOP_RANGE) {
        this.dir = dx < 0 ? -1 : 1;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.vel.set(this.dir * HOPPER_VX, -HOPPER_VY);
          this.onGround = false;
          this.timer = HOP_EVERY;
          sfx('hopper_hop', { volume: this.soundVolume() });
        }
      } else {
        this.timer = HOP_EVERY;
      }
    }
    this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
    const hit = level.moveAndCollide(this, dt);
    if (hit.wall) this.vel.x = 0;
    this.onGround = hit.ground;
    if (this.pos.y > level.h + T) this.destroy();
  }

  render(r) {
    let sx = 1;
    let sy = 1;
    if (this.onGround && this.timer < HOP_TELL) {
      sx = 1.3; // the tell: a squash before the hop
      sy = 0.7;
    } else if (!this.onGround) {
      sx = 0.85;
      sy = 1.2;
    }
    r.sprite(characters().frame(FRAMES.hopper), Math.round(this.cx), Math.round(this.pos.y + this.h), {
      w: Math.round(16 * sx),
      h: Math.round(16 * sy),
      flipX: this.dir < 0,
    });
  }
}

/** Slime in a tin helmet. The first stomp knocks the helmet off and it speeds up; the second defeats it (§4.3). */
export class GloopKnight extends Enemy {
  constructor(x, y) {
    super({ x: x + 2, y: y + 3, w: 12, h: 13 }, { score: 400 });
    this.dir = -1;
    this.helmet = true;
    this.t = Math.random() * 10;
  }

  update(dt) {
    if (!this.onCamera) return;
    const level = this.scene.level;
    this.t += dt;
    this.vel.x = this.dir * (this.helmet ? KNIGHT_SPEED : KNIGHT_SPEED_BARE);
    this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
    const hit = level.moveAndCollide(this, dt);
    if (hit.wall || (hit.ground && !level.groundAhead(this, this.dir))) this.dir = -this.dir;
    if (this.pos.y > level.h + T) this.destroy();
  }

  onStomp() {
    if (!this.helmet) return super.onStomp();
    this.helmet = false;
    // Without the helmet the hitbox shrinks to the slime underneath.
    this.pos.y += 3;
    this.h = 10;
    sfx('stomp_armor');
    this.scene.add(new FlyingHelmet(this.cx, this.pos.y - 4, -this.dir));
    return false;
  }

  render(r) {
    const wob = Math.sin(this.t * (this.helmet ? 10 : 16)) * 0.06;
    r.sprite(characters().frame(this.helmet ? FRAMES.knight : FRAMES.knight_bare), Math.round(this.cx), Math.round(this.pos.y + this.h), {
      w: Math.round(16 * (1 + wob)),
      h: Math.round(16 * (1 - wob)),
      flipX: this.dir < 0,
    });
  }
}

/** The knocked-off helmet, spinning away. Decoration only. */
class FlyingHelmet extends Entity {
  constructor(x, y, dir) {
    super({ x, y, w: 8, h: 6, z: 6, tags: ['fx'] });
    this.debug = false;
    this.vel.set(dir * 60, -180);
    this.spin = 0;
  }

  update(dt) {
    this.vel.y += GRAVITY * dt;
    this.spin += dt * 12;
    super.update(dt);
    if (this.pos.y > this.scene.level.h + T) this.destroy();
  }

  render(r) {
    r.sprite(characters().frame(FRAMES.helmet), Math.round(this.pos.x), Math.round(this.pos.y), { rotation: this.spin, originX: 0.5, originY: 0.5 });
  }
}

/** Brown beetle with a spiked back: hurts from above. Walks at 40 px/s, turns at walls but not at ledges (§4.3). */
export class Thornback extends Enemy {
  constructor(x, y) {
    super({ x: x + 2, y: y + 7, w: 12, h: 9 }, { score: 0, stompable: false });
    this.dir = -1;
    this.t = 0;
  }

  update(dt) {
    if (!this.onCamera) return;
    const level = this.scene.level;
    this.t += dt;
    this.vel.x = this.dir * THORNBACK_SPEED;
    this.vel.y = Math.min(this.vel.y + GRAVITY * dt, MAX_FALL);
    const hit = level.moveAndCollide(this, dt);
    if (hit.wall) this.dir = -this.dir;
    if (this.pos.y > level.h + T) this.destroy();
  }

  render(r) {
    const step = Math.round(Math.sin(this.t * 14));
    r.sprite(characters().frame(FRAMES.thornback), Math.round(this.cx), Math.round(this.pos.y + this.h) + Math.min(0, step), {
      flipX: this.dir < 0,
    });
  }
}

/** Sleeps upside down until Hop is within 6 tiles, then flies a sine wave and turns at walls (§4.3). */
export class Bat extends Enemy {
  constructor(x, y) {
    super({ x: x + 2, y: y + 2, w: 12, h: 8 }, { score: 150 });
    this.awake = false;
    this.baseY = this.pos.y + 4 * T * 0.5;
    this.t = 0;
    this.dir = -1;
  }

  update(dt) {
    if (!this.onCamera) return;
    const p = this.scene.player;
    if (!this.awake) {
      if (Math.hypot(p.cx - this.cx, p.cy - this.cy) < BAT_WAKE_RANGE) {
        this.awake = true;
        this.dir = p.cx < this.cx ? -1 : 1;
        this.baseY = this.pos.y + BAT_AMPLITUDE;
        this.t = -Math.PI / 2 / ((2 * Math.PI) / BAT_PERIOD); // start at the top of the wave
        sfx('bat_wake', { volume: this.soundVolume() });
      }
      return;
    }
    this.t += dt;
    const level = this.scene.level;
    const ahead = this.dir > 0 ? this.pos.x + this.w + 1 : this.pos.x - 1;
    if (level.isSolid(Math.floor(ahead / T), Math.floor(this.cy / T))) this.dir = -this.dir;
    this.pos.x += this.dir * BAT_SPEED * dt;
    this.pos.y = this.baseY + Math.sin((this.t * 2 * Math.PI) / BAT_PERIOD) * BAT_AMPLITUDE;
  }

  render(r) {
    const frame = !this.awake ? FRAMES.bat_sleep : Math.sin(this.t * 18) > 0 ? FRAMES.bat_up : FRAMES.bat_down;
    const y = this.awake ? Math.round(this.pos.y + this.h + 4) : Math.round(this.pos.y + 14);
    r.sprite(characters().frame(frame), Math.round(this.cx), y, { flipX: this.dir < 0 });
  }
}

/** Stalactite: when Hop is within 1 tile horizontally and below, shakes 0.35 s, falls at 2× gravity and shatters (§4.3). */
export class Dropper extends Enemy {
  constructor(x, y) {
    super({ x: x + 3, y, w: 10, h: 15 }, { score: 0, stompable: false });
    this.state = 'hang'; // hang | shake | fall
    this.t = 0;
    this.hitPlayer = false;
  }

  update(dt) {
    if (!this.onCamera) return;
    const p = this.scene.player;
    if (this.state === 'hang') {
      if (Math.abs(p.cx - this.cx) < T && p.pos.y > this.pos.y) {
        this.state = 'shake';
        this.t = DROPPER_TELL;
        sfx('dropper_tell', { volume: this.soundVolume() });
      }
    } else if (this.state === 'shake') {
      this.t -= dt;
      if (this.t <= 0) this.state = 'fall';
    } else {
      this.vel.y = Math.min(this.vel.y + DROPPER_GRAVITY * dt, MAX_FALL * 1.5);
      const hit = this.scene.level.moveAndCollide(this, dt);
      if (hit.ground || this.pos.y > this.scene.level.h) this.shatter();
    }
  }

  shatter() {
    sfx('dropper_crash', { volume: this.soundVolume() });
    this.scene.burst(this.cx, this.pos.y + this.h, '#8a8aa0', 10);
    if (!this.hitPlayer) this.scene.addScore(SCORE_DROPPER_DODGED);
    this.destroy();
  }

  onStomp() {
    return false;
  }

  render(r) {
    const jitter = this.state === 'shake' ? Math.round(Math.sin(this.t * 90)) : 0;
    r.sprite(characters().frame(FRAMES.dropper), Math.round(this.cx) + jitter, Math.round(this.pos.y + this.h + 1));
  }
}

/** Stationary cloud. Every 2.5 s, if Hop is within 10 tiles, inflates for 0.4 s and fires a spore at him (§4.3). */
export class Puffer extends Enemy {
  constructor(x, y) {
    super({ x: x + 1, y: y + 2, w: 14, h: 12 }, { score: 200 });
    this.timer = PUFFER_EVERY;
    this.dir = -1;
  }

  update(dt) {
    if (!this.onCamera) return;
    const p = this.scene.player;
    this.dir = p.cx < this.cx ? -1 : 1;
    if (Math.hypot(p.cx - this.cx, p.cy - this.cy) > PUFFER_RANGE) {
      this.timer = Math.max(this.timer, PUFFER_TELL + 0.01);
      return;
    }
    const before = this.timer;
    this.timer -= dt;
    if (before > PUFFER_TELL && this.timer <= PUFFER_TELL) sfx('puffer_tell', { volume: this.soundVolume() });
    if (this.timer > 0) return;
    this.timer = PUFFER_EVERY;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    this.scene.fireSpore(this.cx, this.cy, (dx / d) * SPORE_SPEED, (dy / d) * SPORE_SPEED);
    sfx('spore', { volume: this.soundVolume() });
  }

  render(r) {
    const big = this.timer <= PUFFER_TELL;
    r.sprite(characters().frame(big ? FRAMES.puffer_big : FRAMES.puffer), Math.round(this.cx), Math.round(this.pos.y + this.h + 2), {
      flipX: this.dir > 0,
    });
  }
}

/** Puffer projectile. Hurts on contact; disappears on walls or after 4 s. Pooled. */
export class Spore extends Enemy {
  constructor() {
    super({ w: 6, h: 6 }, { score: 0, stompable: false });
  }

  fire(x, y, vx, vy, pool) {
    this.pos.set(x - 3, y - 3);
    this.vel.set(vx, vy);
    this.life = 4;
    this.pool = pool;
    return this;
  }

  update(dt) {
    super.update(dt);
    this.life -= dt;
    const level = this.scene.level;
    if (this.life <= 0 || level.isSolid(Math.floor(this.cx / T), Math.floor(this.cy / T))) this.onStomp();
  }

  onStomp() {
    if (this.dead) return true;
    this.destroy();
    this.pool.release(this);
    return true;
  }

  render(r) {
    r.sprite(characters().frame(FRAMES.spore), Math.round(this.cx), Math.round(this.cy + 8));
  }
}

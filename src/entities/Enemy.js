import { Entity } from '../../vendor/h3-engine.min.js';
import { characters, FRAMES } from '../art/characters.js';
import { CULL_MARGIN, GRAVITY, HOPPER_VX, HOPPER_VY, KNIGHT_SPEED, KNIGHT_SPEED_BARE, MAX_FALL, SLIME_SPEED, T, VIEW_W } from '../config.js';
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
  }

  update(dt) {
    if (!this.onCamera) return;
    const level = this.scene.level;
    this.t += dt;
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

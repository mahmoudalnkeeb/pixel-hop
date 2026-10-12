import { approach, Entity } from '../../vendor/h3-engine.min.js';
import {
  ACCEL_AIR, ACCEL_GROUND, COYOTE_TIME, DEATH_TIME, DOWN, DROP_THROUGH_TIME, FLICKER_HZ, FRICTION, GRAVITY,
  INVULN_TIME, JUMP, JUMP_BUFFER, JUMP_CUT, JUMP_SPEED, KNOCKBACK_VX, KNOCKBACK_VY, LAND_SQUASH_SPEED, LEFT,
  MAX_FALL, MAX_HEARTS, PLAYER_H, PLAYER_W, RIGHT, RUN_SPEED, SHAKE_HURT, T, WALL_COYOTE, WALL_JUMP_LOCK,
  WALL_JUMP_VX, WALL_JUMP_VY, WALL_SLIDE_MAX,
} from '../config.js';
import { sfx } from '../sfx.js';

const WALL_SLIDE_SFX_EVERY = 0.12;

/**
 * Hop. Run, variable jump, coyote time, jump buffer, stomp bounce, drop-through,
 * wall slide and wall jump, hearts, knockback and pit recovery (§3).
 */
export class Player extends Entity {
  /**
   * @param {number} x Tile-aligned spawn x.
   * @param {number} y Tile-aligned spawn y.
   * @param {{ wallJump: boolean }} abilities
   */
  constructor(x, y, { wallJump }) {
    super({ x: x + (T - PLAYER_W) / 2, y: y + T - PLAYER_H, w: PLAYER_W, h: PLAYER_H, z: 5, tags: ['player'] });
    this.canWallJump = wallJump;
    this.hearts = MAX_HEARTS;
    this.state = 'play'; // 'play' | 'dying' | 'clear'
    this.stateTime = 0;
    this.onGround = false;
    this.platform = null;
    this.coyote = 0;
    this.buffer = 0;
    this.dropTimer = 0;
    this.noCut = false; // springs, stomps and knockback ignore the jump cut
    this.wallCoyote = 0;
    this.wallSide = 0;
    this.wallLock = 0;
    this.sliding = false;
    this.slideSfx = 0;
    this.invuln = 0;
    this.chain = 0;
    this.facing = 1;
    this.sx = 1; // squash and stretch, eased back to 1
    this.sy = 1;
    this.safe = { x: this.pos.x, y: this.pos.y }; // last solid ground, for pits
  }

  update(dt, { input, audio }) {
    const level = this.scene.level;
    if (this.state === 'dying') return this._updateDying(dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dropTimer > 0) this.dropTimer -= dt;

    // Ride moving platforms: apply their movement before ours.
    if (this.onGround && this.platform) {
      this.pos.x += this.platform.dx;
      this.pos.y += this.platform.dy;
    }

    let dir = this.state === 'play' ? input.axis(LEFT, RIGHT) : 0;
    const jumpHeld = this.state === 'play' && input.isDown(JUMP);
    const jumpPressed = this.state === 'play' && input.justPressed(JUMP);
    if (this.wallLock > 0) {
      this.wallLock -= dt;
      if (dir === this.wallSide) dir = 0;
    }
    if (dir !== 0) this.facing = dir;

    const accel = dir !== 0 ? (this.onGround ? ACCEL_GROUND : ACCEL_AIR) : this.onGround ? FRICTION : ACCEL_AIR / 2;
    this.vel.x = approach(this.vel.x, dir * RUN_SPEED, accel * dt);

    // Walls: wall-jumpable tiles directly beside Hop while airborne (§3.2).
    const touchL = this.canWallJump && !this.onGround && level.wallAt(this, -1);
    const touchR = this.canWallJump && !this.onGround && level.wallAt(this, 1);
    if (touchL || touchR) {
      this.wallCoyote = WALL_COYOTE;
      this.wallSide = touchR ? 1 : -1;
    } else {
      this.wallCoyote -= dt;
    }

    this.coyote = this.onGround ? COYOTE_TIME : this.coyote - dt;
    this.buffer = jumpPressed ? JUMP_BUFFER : this.buffer - dt;
    if (this.buffer > 0) {
      if (this.onGround && input.isDown(DOWN) && (this.platform || level.onOneWayOnly(this))) {
        this._dropThrough();
      } else if (this.coyote > 0) {
        this.jump(JUMP_SPEED);
        sfx(audio, 'jump');
      } else if (this.wallCoyote > 0) {
        this._wallJump();
        sfx(audio, 'wall_jump');
      }
    }

    if (this.vel.y >= 0) this.noCut = false;
    const cut = this.vel.y < 0 && !jumpHeld && !this.noCut;
    this.vel.y = Math.min(this.vel.y + GRAVITY * (cut ? JUMP_CUT : 1) * dt, MAX_FALL);

    this.sliding = this.vel.y > 0 && ((touchR && dir > 0) || (touchL && dir < 0));
    if (this.sliding) {
      this.vel.y = Math.min(this.vel.y, WALL_SLIDE_MAX);
      this.slideSfx -= dt;
      if (this.slideSfx <= 0) {
        sfx(audio, 'wall_slide');
        this.slideSfx = WALL_SLIDE_SFX_EVERY;
      }
    } else {
      this.slideSfx = 0;
    }

    const wasOnGround = this.onGround;
    const landingSpeed = this.vel.y;
    const hit = level.moveAndCollide(this, dt);
    this.onGround = hit.ground;
    this.platform = hit.platform;
    if (this.onGround) {
      this.chain = 0;
      if (!this.platform && level.fullySupported(this)) {
        this.safe.x = this.pos.x;
        this.safe.y = this.pos.y;
      }
      if (!wasOnGround && landingSpeed > LAND_SQUASH_SPEED) {
        this.sx = 1.3;
        this.sy = 0.7;
        sfx(audio, 'land', { volume: Math.min(1, landingSpeed / MAX_FALL) });
        this.scene.dust?.(this.cx, this.pos.y + this.h, 4);
      }
    }
    this.sx = approach(this.sx, 1, dt * 3);
    this.sy = approach(this.sy, 1, dt * 3);

    if (this.state !== 'play') return;
    if (level.touchesSpikes(this)) this.hurt(this.cx + this.facing);
    if (this.pos.y > level.h) this._fellInPit(audio);
  }

  jump(speed) {
    this.vel.y = -speed;
    this.buffer = 0;
    this.coyote = 0;
    this.wallCoyote = 0;
    this.onGround = false;
    this.platform = null;
    this.sx = 0.75;
    this.sy = 1.3;
  }

  /** Launch that ignores the jump cut, so its height is fixed (springs, stomps). */
  bounce(speed) {
    this.jump(speed);
    this.noCut = true;
  }

  _wallJump() {
    const away = -this.wallSide;
    this.jump(WALL_JUMP_VY);
    this.vel.x = away * WALL_JUMP_VX;
    this.facing = away;
    this.wallLock = WALL_JUMP_LOCK;
    this.scene.dust?.(this.wallSide > 0 ? this.pos.x + this.w : this.pos.x, this.cy, 3);
  }

  _dropThrough() {
    this.dropTimer = DROP_THROUGH_TIME;
    this.buffer = 0;
    this.coyote = 0;
    this.onGround = false;
    this.platform = null;
    this.pos.y += 1;
  }

  /**
   * Lose a heart with knockback away from `fromX` (§3.4).
   * @returns {boolean} Whether damage was taken.
   */
  hurt(fromX) {
    if (this.state !== 'play' || this.invuln > 0) return false;
    const { audio } = this.scene.ctx;
    this.hearts--;
    this.scene.camera.shake(SHAKE_HURT, 0.2);
    if (this.hearts <= 0) {
      this._die();
      return true;
    }
    sfx(audio, 'hurt');
    this.vel.x = (this.cx >= fromX ? 1 : -1) * KNOCKBACK_VX;
    this.bounce(KNOCKBACK_VY);
    this.invuln = INVULN_TIME;
    return true;
  }

  /** Pits cost a heart and put Hop back on the last solid ground he stood on (§3.4). */
  _fellInPit(audio) {
    this.hearts--;
    if (this.hearts <= 0) {
      this._die();
      return;
    }
    sfx(audio, 'pit');
    this.pos.set(this.safe.x, this.safe.y);
    this.vel.set(0, 0);
    this.invuln = INVULN_TIME;
    this.scene.camera.snap();
  }

  _die() {
    sfx(this.scene.ctx.audio, 'die');
    this.state = 'dying';
    this.stateTime = DEATH_TIME;
    this.vel.set(0, 0);
    this.scene.onPlayerDied?.();
  }

  _updateDying(dt) {
    this.stateTime -= dt;
    if (this.stateTime <= 0) this.scene.respawn();
  }

  /** Back to full health at a point (checkpoint respawn). */
  revive(x, y) {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.hearts = MAX_HEARTS;
    this.state = 'play';
    this.invuln = 0;
    this.onGround = false;
    this.platform = null;
    this.chain = 0;
    this.sx = this.sy = 1;
    this.safe.x = x;
    this.safe.y = y;
  }

  render(r) {
    if (this.invuln > 0 && Math.floor(this.invuln * FLICKER_HZ * 2) % 2 === 1) return;
    let sx = this.sx;
    let sy = this.sy;
    if (this.state === 'dying') {
      const t = Math.max(0, this.stateTime / DEATH_TIME);
      sx = 1 + (1 - t) * 0.6;
      sy = t;
    }
    // Squash and stretch around the feet. Replace with animation frames (§7).
    const w = Math.max(1, Math.round(this.w * sx));
    const h = Math.max(1, Math.round(this.h * sy));
    const x = Math.round(this.cx - w / 2);
    const y = Math.round(this.pos.y + this.h - h);
    r.rect(x + 1, y, w - 2, h, '#ff5e5b');
    r.rect(x, y + 2, w, h - 3, '#ff5e5b');
    r.rect(x + 1, y + h - 2, w - 2, 2, '#d8423f');
    if (h < 6) return;
    // Big eyes looking where Hop faces.
    const ex = Math.round(this.cx + this.facing * 2);
    const ey = y + 3;
    r.rect(ex - 4, ey, 3, 4, '#fff');
    r.rect(ex + 1, ey, 3, 4, '#fff');
    const px = this.facing > 0 ? 1 : 0;
    r.rect(ex - 4 + px + 1, ey + 1, 1, 2, '#222');
    r.rect(ex + 1 + px + 1, ey + 1, 1, 2, '#222');
  }
}

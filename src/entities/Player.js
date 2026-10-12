import { approach, Entity } from '../../vendor/h3-engine.min.js';
import {
  ACCEL_AIR, ACCEL_GROUND, COYOTE_TIME, DEATH_TIME, DOWN, DROP_THROUGH_TIME, FLICKER_HZ, FRICTION, GRAVITY,
  INVULN_TIME, JUMP, JUMP_BUFFER, JUMP_CUT, JUMP_SPEED, KNOCKBACK_VX, KNOCKBACK_VY, LAND_SQUASH_SPEED, LEFT,
  MAX_FALL, MAX_HEARTS, PLAYER_H, PLAYER_W, RIGHT, RUN_SPEED, SHAKE_HURT, SPRING_SPEED, SWITCH_STOMP_SPEED, T,
  UPDRAFT_MAX, WALL_COYOTE, WALL_JUMP_LOCK, WALL_JUMP_VX, WALL_JUMP_VY, WALL_SLIDE_MAX, WIND_DRIFT,
} from '../config.js';
import { characters, FRAMES, GOLD } from '../art/characters.js';
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
   * @param {{ wallJump: boolean, maxHearts?: number, invincible?: boolean, golden?: boolean }} opts
   */
  constructor(x, y, { wallJump, maxHearts = MAX_HEARTS, invincible = false, golden = false }) {
    super({ x: x + (T - PLAYER_W) / 2, y: y + T - PLAYER_H, w: PLAYER_W, h: PLAYER_H, z: 5, tags: ['player'] });
    this.canWallJump = wallJump;
    this.maxHearts = maxHearts; // Assist Mode can raise this to 5 (§9.5)
    this.invincible = invincible;
    this.golden = golden; // "Golden Hop" palette, unlocked by all 27 gems
    this.hearts = maxHearts;
    this.groundSolid = null;
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
    this.anim = 0;
  }

  update(dt, { input, audio }) {
    const level = this.scene.level;
    this.anim += dt;
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
        sfx('jump');
      } else if (this.wallCoyote > 0) {
        this._wallJump();
        sfx('wall_jump');
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
        sfx('wall_slide');
        this.slideSfx = WALL_SLIDE_SFX_EVERY;
      }
    } else {
      this.slideSfx = 0;
    }

    // Wind (§4.2): horizontal zones drift Hop without fighting the run controller; updrafts lift him.
    let drift = 0;
    const winds = this.scene.winds;
    if (winds) {
      for (let i = 0; i < winds.length; i++) {
        const w = winds[i];
        if (!w.contains(this)) continue;
        if (w.up) this.vel.y = Math.max(this.vel.y - w.force * dt, -UPDRAFT_MAX);
        else drift += w.dir * w.force * WIND_DRIFT;
      }
    }

    const wasOnGround = this.onGround;
    const landingSpeed = this.vel.y;
    this.vel.x += drift;
    const hit = level.moveAndCollide(this, dt);
    if (this.vel.x !== 0) this.vel.x -= drift;
    this.onGround = hit.ground;
    this.platform = hit.platform;
    this.groundSolid = hit.groundSolid;
    // Switches: hit from below, or landed on hard (§4.1).
    if (hit.ceilingSolid?.bump) hit.ceilingSolid.bump();
    if (this.onGround && !wasOnGround && landingSpeed > SWITCH_STOMP_SPEED && hit.groundSolid?.bump) hit.groundSolid.bump();
    if (this.onGround) {
      this.chain = 0;
      if (!this.platform && level.fullySupported(this)) {
        this.safe.x = this.pos.x;
        this.safe.y = this.pos.y;
      }
      if (!wasOnGround && landingSpeed > LAND_SQUASH_SPEED) {
        this.sx = 1.3;
        this.sy = 0.7;
        sfx('land', { volume: Math.min(1, landingSpeed / MAX_FALL) });
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
    if (this.invincible) {
      this.vel.x = (this.cx >= fromX ? 1 : -1) * KNOCKBACK_VX;
      this.bounce(KNOCKBACK_VY);
      this.invuln = INVULN_TIME;
      return false;
    }
    const { audio } = this.scene.ctx;
    this.hearts--;
    this.scene.camera.shake(SHAKE_HURT, 0.2);
    if (this.hearts <= 0) {
      this._die();
      return true;
    }
    sfx('hurt');
    this.vel.x = (this.cx >= fromX ? 1 : -1) * KNOCKBACK_VX;
    this.bounce(KNOCKBACK_VY);
    this.invuln = INVULN_TIME;
    return true;
  }

  /** Rising thornwater is fatal (Assist invincibility still saves him). */
  drown() {
    if (this.invincible) {
      this.bounce(SPRING_SPEED);
      return;
    }
    this.hearts = 0;
    this._die();
  }

  /** Pits cost a heart and put Hop back on the last solid ground he stood on (§3.4). */
  _fellInPit(audio) {
    if (!this.invincible) this.hearts--;
    if (this.hearts <= 0) {
      this._die();
      return;
    }
    sfx('pit');
    this.pos.set(this.safe.x, this.safe.y);
    this.vel.set(0, 0);
    this.invuln = INVULN_TIME;
    this.scene.camera.snap();
  }

  _die() {
    sfx('die');
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
    this.hearts = this.maxHearts;
    this.state = 'play';
    this.invuln = 0;
    this.onGround = false;
    this.platform = null;
    this.chain = 0;
    this.sx = this.sy = 1;
    this.safe.x = x;
    this.safe.y = y;
  }

  /** Which expression to show this frame. */
  _frame() {
    const gold = this.golden ? GOLD : 0;
    if (this.state === 'dying' || this.invuln > INVULN_TIME - 0.3) return FRAMES.hop_hurt + gold;
    if (this.sliding) return FRAMES.hop_slide + gold;
    if (!this.onGround) return (this.vel.y < 0 ? FRAMES.hop_up : FRAMES.hop_down) + gold;
    return (this.anim % 3.2 > 3.05 ? FRAMES.hop_blink : FRAMES.hop_idle) + gold;
  }

  render(r) {
    const blinking = this.invuln > 0 && this.state === 'play';
    // Reduced flashing (§9.5): an outline instead of a 15 Hz flicker.
    if (blinking && !this.reduceFlashing && Math.floor(this.invuln * FLICKER_HZ * 2) % 2 === 1) return;
    let sx = this.sx;
    let sy = this.sy;
    if (this.state === 'dying') {
      const t = Math.max(0, this.stateTime / DEATH_TIME);
      sx = 1 + (1 - t) * 0.6;
      sy = t;
    } else if (this.onGround && Math.abs(this.vel.x) > 20) {
      // Run cycle: a squashy bounce instead of legs.
      const bob = Math.sin(this.anim * 22);
      sy += bob * 0.08;
      sx -= bob * 0.05;
    }
    if (sy <= 0) return;
    const frame = characters().frame(this._frame());
    r.sprite(frame, Math.round(this.cx), Math.round(this.pos.y + this.h), {
      w: Math.round(16 * sx),
      h: Math.round(16 * sy),
      flipX: this.facing < 0,
    });
    if (blinking && this.reduceFlashing) r.strokeRect(Math.round(this.pos.x) - 1.5, Math.round(this.pos.y) - 1.5, this.w + 3, this.h + 3, '#fff');
  }
}

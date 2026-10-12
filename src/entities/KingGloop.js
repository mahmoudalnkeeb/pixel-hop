import { approach, clamp, Entity } from '../../vendor/h3-engine.min.js';
import { BOSS_FRAMES, bossSheet } from '../art/boss.js';
import {
  BOSS_AIR_TIME, BOSS_DAZED, BOSS_HIT_BOUNCE, BOSS_HIT_INVULN, BOSS_HOP_PEAK, BOSS_HP, BOSS_PHASE_HP, BOSS_PHASES_BUILT,
  BOSS_TELL, SHAKE_BOSS_SLAM, SHOCKWAVE_SPEED, T,
} from '../config.js';
import { sfx } from '../sfx.js';

// Hop arc: peak BOSS_HOP_PEAK tiles over BOSS_AIR_TIME seconds.
const GRAVITY = (8 * BOSS_HOP_PEAK * T) / BOSS_AIR_TIME ** 2;
const JUMP_VY = (4 * BOSS_HOP_PEAK * T) / BOSS_AIR_TIME;
const ROAR_TIME = 2;
const IDLE_TIME = 0.6;
const BETWEEN_HOPS = 0.3;
const HOPS = 3;
const STOMP_REACH = 12;
const DEFEAT_TIME = 1.6;

/**
 * King Gloop (§6). Phase 1 "Royal Hop": three telegraphed hops that send shockwaves along the
 * floor, the third a belly-flop that leaves him Dazed. He can only be hurt by a stomp while Dazed.
 * Phases 2–3 are M2 work; until then losing phase 1 ends the fight.
 */
export class KingGloop extends Entity {
  /** @param {number} x Spawn centre x. @param {number} floorY Top of the arena floor. */
  constructor(x, floorY) {
    super({ x: x - 24, y: floorY - 40, w: 48, h: 40, z: 4, tags: ['enemy', 'boss'] });
    this.spawnX = this.pos.x;
    this.spawnY = this.pos.y;
    this.hp = BOSS_HP;
    this.phase = 1;
    this.state = 'waiting'; // waiting | intro | idle | tell | air | dazed | hit | defeated
    this.time = 0;
    this.hops = 0;
    this.flash = 0;
    this.sx = 1;
    this.sy = 1;
    this.facing = -1;
    this.onGround = true;
    this.dropTimer = Infinity; // never lands on the one-way ledges
    this.t = 0;
  }

  get fighting() {
    return this.state !== 'waiting' && this.state !== 'defeated';
  }

  /** Begin the fight; the roar intro plays only the first time (§6.4). */
  start(withIntro) {
    this._enter(withIntro ? 'intro' : 'idle', withIntro ? ROAR_TIME : 1.0);
    if (withIntro) {
      sfx('boss_roar');
      this.scene.camera.shake(3, 0.5);
    }
  }

  /** Dying restarts the current phase with the boss at that phase's starting HP (§6.4). */
  restartPhase() {
    this.hp = BOSS_PHASE_HP[this.phase - 1];
    this.pos.set(this.spawnX, this.spawnY);
    this.vel.set(0, 0);
    this.hops = 0;
    this.flash = 0;
    this.state = 'waiting';
  }

  _enter(state, time) {
    this.state = state;
    this.time = time;
  }

  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    this.sx = approach(this.sx, 1, dt * 3);
    this.sy = approach(this.sy, 1, dt * 3);
    if (this.state === 'waiting') return;
    this.time -= dt;

    if (this.state === 'defeated') {
      this.sx = 1 + (1 - this.time / DEFEAT_TIME) * 0.4;
      this.sy = Math.max(0.3, this.time / DEFEAT_TIME);
      if (this.time <= 0 && !this.reported) {
        this.reported = true;
        this.scene.onBossDefeated();
      }
      return;
    }

    const level = this.scene.level;
    this.vel.y += GRAVITY * dt;
    const wasGround = this.onGround;
    const hit = level.moveAndCollide(this, dt);
    this.onGround = hit.ground;
    if (this.onGround) this.vel.x = 0;

    if (this.state === 'air') {
      if (this.onGround && !wasGround) this._land();
      return;
    }
    if (this.time > 0) return;
    if (this.state === 'intro') {
      this.scene.onBossRoared?.();
      this._enter('idle', IDLE_TIME);
    } else if (this.state === 'idle' || this.state === 'hit') {
      this._tell();
    } else if (this.state === 'tell') {
      this._hop();
    } else if (this.state === 'dazed') {
      this.hops = 0;
      this._enter('idle', IDLE_TIME);
    }
  }

  _tell() {
    this._enter('tell', BOSS_TELL);
    this.sx = 1.25;
    this.sy = 0.75;
    sfx('boss_tell_hop');
  }

  /** Jump toward Hop's x position. */
  _hop() {
    const player = this.scene.player;
    const arena = this.scene.arena;
    const target = clamp(player.cx, arena.x + 2 * T + this.w / 2, arena.x + arena.w - 2 * T - this.w / 2);
    this.facing = target < this.cx ? -1 : 1;
    this.vel.set((target - this.cx) / BOSS_AIR_TIME, -JUMP_VY);
    this.onGround = false;
    this.sx = 0.8;
    this.sy = 1.25;
    this._enter('air', 0);
  }

  _land() {
    this.hops++;
    const bellyFlop = this.hops >= HOPS;
    this.sx = bellyFlop ? 1.45 : 1.3;
    this.sy = bellyFlop ? 0.6 : 0.75;
    sfx('boss_land');
    this.scene.camera.shake(bellyFlop ? SHAKE_BOSS_SLAM : 3, bellyFlop ? 0.3 : 0.2);
    this.scene.spawnShockwaves(this.cx, this.pos.y + this.h);
    if (bellyFlop) {
      this._enter('dazed', BOSS_DAZED[this.phase - 1]);
      sfx('boss_dazed');
    } else {
      this._enter('idle', BETWEEN_HOPS);
    }
  }

  /** Contact with Hop: a stomp while Dazed hurts the King; anything else hurts Hop (§6.1). */
  touch(p) {
    const stomp = p.vel.y > 0 && p.pos.y + p.h - this.pos.y < STOMP_REACH;
    if (this.state === 'dazed' && stomp) {
      this._takeHit(p);
    } else if (this.state === 'hit' || this.state === 'defeated' || this.state === 'waiting') {
      if (stomp) p.bounce(BOSS_HIT_BOUNCE / 2);
    } else {
      p.hurt(this.cx);
    }
  }

  _takeHit(p) {
    this.hp--;
    p.pos.y = this.pos.y - p.h;
    p.bounce(BOSS_HIT_BOUNCE);
    this.flash = 0.2;
    this.sx = 1.3;
    this.sy = 0.7;
    this.scene.camera.shake(3, 0.2);
    sfx('boss_hit');
    this.scene.burst(this.cx, this.pos.y + 6, '#8fd14f', 16);
    if (this.hp <= BOSS_PHASE_HP[this.phase]) {
      if (this.phase >= BOSS_PHASES_BUILT) {
        this._enter('defeated', DEFEAT_TIME);
        sfx('boss_defeat');
        this.scene.onBossBeaten?.();
        return;
      }
      this.phase++;
      this.scene.onBossPhase?.(this.phase);
    }
    this._enter('hit', BOSS_HIT_INVULN);
  }

  render(r) {
    let frame = BOSS_FRAMES.idle;
    if (this.flash > 0) frame = BOSS_FRAMES.flash;
    else if (this.state === 'intro') frame = BOSS_FRAMES.roar;
    else if (this.state === 'tell') frame = BOSS_FRAMES.tell;
    else if (this.state === 'dazed' || this.state === 'defeated') frame = BOSS_FRAMES.dazed;
    const dazed = this.state === 'dazed';
    r.sprite(bossSheet().frame(frame), Math.round(this.cx), Math.round(this.pos.y + this.h), {
      w: Math.round(56 * this.sx),
      h: Math.round(48 * this.sy),
      flipX: this.facing > 0,
      rotation: dazed ? Math.sin(this.t * 9) * 0.06 : 0,
    });
    if (dazed) {
      // Stars circling his head.
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + (i * Math.PI * 2) / 3;
        const sx = Math.round(this.cx + Math.cos(a) * 20);
        const sy = Math.round(this.pos.y - 8 + Math.sin(a) * 5);
        r.rect(sx - 1, sy, 3, 1, '#ffe27a');
        r.rect(sx, sy - 1, 1, 3, '#ffe27a');
      }
    }
  }
}

/** Goo wave rolling along the floor from a boss landing (§6.3). Jump over it or stand on a ledge. */
export class Shockwave extends Entity {
  constructor(x, floorY, dir) {
    super({ x: x - 8, y: floorY - 8, w: 16, h: 8, z: 4, tags: ['enemy', 'shockwave'] });
    this.vel.x = dir * SHOCKWAVE_SPEED;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    super.update(dt);
    const level = this.scene.level;
    const ahead = this.vel.x > 0 ? this.pos.x + this.w : this.pos.x;
    if (level.isSolid(Math.floor(ahead / T), Math.floor((this.pos.y + 4) / T))) this.destroy();
  }

  render(r) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const crest = this.vel.x > 0 ? 10 : 2;
    const bob = Math.round(Math.sin(this.t * 30));
    r.rect(x, y + 4, 16, 4, '#5fa83a');
    r.rect(x + 2, y + 2 + bob, 12, 3, '#8fd14f');
    r.rect(x + crest, y + bob, 4, 3, '#d2f59c');
  }
}

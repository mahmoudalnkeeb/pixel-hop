import { approach, clamp, Entity, randInt } from '../../vendor/h3-engine.min.js';
import { BOSS_FRAMES, bossSheet } from '../art/boss.js';
import { characters, FRAMES } from '../art/characters.js';
import {
  BOSS_AIR_TIME, BOSS_BELCH_TELL, BOSS_CHARGE_SPEED, BOSS_CHARGE_TELL, BOSS_COURT_TIMEOUT, BOSS_DAZED, BOSS_GOO_EVERY,
  BOSS_HIT_BOUNCE, BOSS_HIT_INVULN, BOSS_HOP_PEAK, BOSS_HP, BOSS_PHASE3_SPEED, BOSS_PHASE_HP, BOSS_TELL, GRAVITY as G,
  SHAKE_BOSS_SLAM, SHOCKWAVE_SPEED, T,
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
const MINIONS = 3;

/**
 * King Gloop (§6). Three phases, two hits each; he can only be hurt by a stomp while Dazed.
 * 1 "Royal Hop": three telegraphed hops with floor shockwaves, then a belly-flop and a daze.
 * 2 "Court of Slimes": belches 3 Slimes and lobs goo until they're gone (or 10 s), then belly-flops.
 * 3 "Tantrum": ×1.25 speed; charges across the arena, slams the wall, rocks fall, then he's dazed.
 */
export class KingGloop extends Entity {
  /** @param {number} x Spawn centre x. @param {number} floorY Top of the arena floor. */
  constructor(x, floorY) {
    super({ x: x - 24, y: floorY - 40, w: 48, h: 40, z: 4, tags: ['enemy', 'boss'] });
    this.spawnX = this.pos.x;
    this.spawnY = this.pos.y;
    this.floorY = floorY;
    this.hp = BOSS_HP;
    this.phase = 1;
    this.state = 'waiting';
    this.time = 0;
    this.hops = 0;
    this.landing = 'shock'; // what the next landing does: shock | quiet | flop
    this.flash = 0;
    this.sx = 1;
    this.sy = 1;
    this.facing = -1;
    this.onGround = true;
    this.dropTimer = Infinity; // never lands on the one-way ledges
    this.gooTimer = 0;
    this.t = 0;
  }

  get speed() {
    return this.phase === 3 ? BOSS_PHASE3_SPEED : 1;
  }

  /** Begin (or resume) the current phase. The roar intro plays only the first time (§6.4). */
  start(withIntro) {
    if (withIntro) {
      this._enter('intro', ROAR_TIME);
      sfx('boss_roar');
      this.scene.camera.shake(3, 0.5);
    } else {
      this._beginPhase();
    }
  }

  /** Dying restarts the current phase with the boss at that phase's starting HP (§6.4). */
  restartPhase() {
    this.hp = BOSS_PHASE_HP[this.phase - 1];
    this.pos.set(this.spawnX, this.spawnY);
    this.vel.set(0, 0);
    this.hops = 0;
    this.flash = 0;
    this.sx = this.sy = 1;
    this.state = 'waiting';
  }

  _enter(state, time) {
    this.state = state;
    this.time = time;
  }

  _beginPhase() {
    this.hops = 0;
    if (this.phase === 2) this._hopTo(this.scene.arena.x + this.scene.arena.w / 2, 'quiet', 'center');
    else if (this.phase === 3) this._chargeTell();
    else this._enter('idle', IDLE_TIME);
  }

  update(rawDt) {
    const dt = rawDt * this.speed;
    this.t += dt;
    if (this.flash > 0) this.flash -= rawDt;
    this.sx = approach(this.sx, 1, dt * 3);
    this.sy = approach(this.sy, 1, dt * 3);
    if (this.state === 'waiting' || this.state === 'gone') return;
    this.time -= dt;

    if (this.state === 'defeated') return this._updateDefeated(dt);

    const level = this.scene.level;
    this.vel.y += GRAVITY * dt;
    if (this.state === 'charge') this.vel.x = this.facing * BOSS_CHARGE_SPEED;
    const wasGround = this.onGround;
    const hit = level.moveAndCollide(this, dt);
    this.onGround = hit.ground;
    if (this.state === 'charge') {
      if (hit.wall) this._slam();
      return;
    }
    if (this.onGround) this.vel.x = 0;
    if (this.state === 'air') {
      if (this.onGround && !wasGround) this._land();
      return;
    }
    if (this.state === 'court') return this._updateCourt(dt);
    if (this.time > 0) return;

    switch (this.state) {
      case 'intro':
        this.scene.onBossRoared?.();
        this._enter('idle', IDLE_TIME);
        break;
      case 'roar':
        this._beginPhase();
        break;
      case 'idle':
      case 'hit':
        if (this.phase === 1) this._tell();
        else if (this.phase === 2) this._beginPhase();
        else this._chargeTell();
        break;
      case 'tell':
        this._hopTo(this.scene.player.cx, this.hops + 1 >= HOPS ? 'flop' : 'shock', 'air');
        break;
      case 'belch':
        this._belch();
        break;
      case 'flopTell':
        this._hopTo(this.scene.player.cx, 'flop', 'air');
        break;
      case 'chargeTell':
        this._enter('charge', 0);
        sfx('boss_charge');
        break;
      case 'dazed':
        this.hops = 0;
        if (this.phase === 1) this._enter('idle', IDLE_TIME);
        else if (this.phase === 2) this._beginPhase();
        else this._chargeTell();
        break;
    }
  }

  // --- Phase 1 ---

  _tell() {
    this._enter('tell', BOSS_TELL);
    this.sx = 1.25;
    this.sy = 0.75;
    sfx('boss_tell_hop');
  }

  /** Jump to x; `landing` decides what happens on touchdown. */
  _hopTo(x, landing, state) {
    const arena = this.scene.arena;
    const target = clamp(x, arena.x + 2 * T + this.w / 2, arena.x + arena.w - 2 * T - this.w / 2);
    this.facing = target < this.cx ? -1 : 1;
    this.vel.set((target - this.cx) / BOSS_AIR_TIME, -JUMP_VY);
    this.onGround = false;
    this.landing = landing;
    this.sx = 0.8;
    this.sy = 1.25;
    this._enter(state === 'center' ? 'air' : state, 0);
    this.afterLanding = state === 'center' ? 'belch' : null;
  }

  _land() {
    const flop = this.landing === 'flop';
    this.sx = flop ? 1.45 : 1.3;
    this.sy = flop ? 0.6 : 0.75;
    sfx('boss_land');
    this.scene.camera.shake(flop ? SHAKE_BOSS_SLAM : 3, flop ? 0.3 : 0.2);
    if (this.landing !== 'quiet') this.scene.spawnShockwaves(this.cx, this.pos.y + this.h);
    if (flop) {
      this._daze();
    } else if (this.afterLanding === 'belch') {
      this._enter('belch', BOSS_BELCH_TELL);
      sfx('boss_belch');
    } else {
      this.hops++;
      this._enter('idle', BETWEEN_HOPS);
    }
    this.afterLanding = null;
  }

  _daze() {
    this._enter('dazed', BOSS_DAZED[this.phase - 1]);
    sfx('boss_dazed');
    this.scene.caption?.('[King Gloop is dazed - stomp him!]');
  }

  // --- Phase 2 ---

  _belch() {
    const arena = this.scene.arena;
    const used = new Set();
    for (let i = 0; i < MINIONS; i++) {
      let col;
      do col = randInt(3, 16);
      while (used.has(col) || used.has(col - 1) || used.has(col + 1));
      used.add(col);
      this.scene.spawnMinion(this.cx, this.pos.y + 12, arena.x + col * T + T / 2);
    }
    this.scene.caption?.('[King Gloop belches up his court]');
    this.gooTimer = BOSS_GOO_EVERY;
    this._enter('court', BOSS_COURT_TIMEOUT);
  }

  _updateCourt(dt) {
    this.gooTimer -= dt;
    this.facing = this.scene.player.cx < this.cx ? -1 : 1;
    if (this.gooTimer <= 0) {
      this.gooTimer = BOSS_GOO_EVERY;
      this.scene.lobGoo(this.cx + this.facing * 14, this.pos.y + 20, this.scene.player.cx);
      this.sx = 0.9;
      this.sy = 1.1;
    }
    if (this.scene.count('minion') === 0 || this.time <= 0) {
      this._enter('flopTell', BOSS_TELL);
      this.sx = 1.25;
      this.sy = 0.75;
      sfx('boss_tell_hop');
    }
  }

  // --- Phase 3 ---

  _chargeTell() {
    this.facing = this.scene.player.cx < this.cx ? -1 : 1;
    this._enter('chargeTell', BOSS_CHARGE_TELL);
    sfx('boss_tell_charge');
    this.scene.caption?.('[King Gloop scrapes his foot]');
  }

  _slam() {
    this.vel.x = 0;
    sfx('wall_slam');
    this.scene.camera.shake(SHAKE_BOSS_SLAM, 0.4);
    this.sx = 0.7;
    this.sy = 1.2;
    // Four random columns, never all next to each other (§6.3).
    const cols = new Set();
    while (cols.size < 4) cols.add(randInt(1, 18));
    const sorted = [...cols].sort((a, b) => a - b);
    if (sorted[3] - sorted[0] === 3) cols.delete(sorted[3]), cols.add(sorted[0] > 9 ? 2 : 17);
    this.scene.dropRocks([...cols]);
    this._daze();
  }

  // --- Contact and damage ---

  /** Contact with Hop: a stomp while Dazed hurts the King; anything else hurts Hop (§6.1). */
  touch(p) {
    const stomp = p.vel.y > 0 && p.pos.y + p.h - this.pos.y < STOMP_REACH;
    if (this.state === 'dazed' && stomp) {
      this._takeHit(p);
    } else if (['hit', 'roar', 'defeated', 'waiting', 'gone'].includes(this.state)) {
      if (stomp) p.bounce(BOSS_HIT_BOUNCE / 2);
    } else {
      p.hurt(this.cx);
    }
  }

  _takeHit(p) {
    this.hp--;
    p.pos.y = this.pos.y - p.h;
    p.bounce(BOSS_HIT_BOUNCE);
    this.flash = this.scene.reduceFlashing ? 1 / 60 : 0.2;
    this.sx = 1.3;
    this.sy = 0.7;
    this.scene.camera.shake(3, 0.2);
    sfx('boss_hit');
    this.scene.burst(this.cx, this.pos.y + 6, '#8fd14f', 16);
    if (this.hp <= 0) {
      this._enter('defeated', DEFEAT_TIME);
      sfx('boss_defeat');
      this.scene.onBossBeaten?.();
      return;
    }
    if (this.hp <= BOSS_PHASE_HP[this.phase]) {
      this.phase++;
      this._enter('roar', ROAR_TIME);
      sfx('boss_roar');
      this.scene.camera.shake(3, 0.5);
      this.scene.onBossPhase?.(this.phase);
      return;
    }
    this._enter('hit', BOSS_HIT_INVULN);
  }

  _updateDefeated(dt) {
    // Deflate to Slime size, then spit out the Sun Seed (§6.3).
    const k = Math.max(0, this.time / DEFEAT_TIME);
    this.sx = 0.3 + 0.9 * k + (1 - k) * 0.1 * Math.sin(this.t * 30);
    this.sy = 0.3 + 0.7 * k;
    if (this.time <= 0) {
      this.state = 'gone';
      this.untag('enemy');
      this.scene.onBossDefeated(this.cx, this.pos.y + this.h - 12);
    }
  }

  render(r) {
    if (this.state === 'gone') {
      // What's left of the King: a sulking crowned slime.
      r.sprite(characters().frame(FRAMES.slime), Math.round(this.cx), Math.round(this.pos.y + this.h));
      return;
    }
    let frame = BOSS_FRAMES.idle;
    if (this.flash > 0) frame = BOSS_FRAMES.flash;
    else if (this.state === 'intro' || this.state === 'roar' || this.state === 'belch') frame = BOSS_FRAMES.roar;
    else if (this.state === 'tell' || this.state === 'flopTell' || this.state === 'chargeTell') frame = BOSS_FRAMES.tell;
    else if (this.state === 'dazed' || this.state === 'defeated') frame = BOSS_FRAMES.dazed;
    const dazed = this.state === 'dazed';
    const scrape = this.state === 'chargeTell' ? Math.round(Math.sin(this.t * 40)) : 0;
    r.sprite(bossSheet().frame(frame), Math.round(this.cx) + scrape, Math.round(this.pos.y + this.h), {
      w: Math.round(56 * this.sx),
      h: Math.round(48 * this.sy),
      flipX: this.facing > 0,
      rotation: dazed ? Math.sin(this.t * 9) * 0.06 : 0,
    });
    if (this.state === 'chargeTell' || this.state === 'charge') {
      // Eyes glow red before and during the charge.
      for (const dx of [-8, 8]) r.rect(Math.round(this.cx + dx * this.sx) - 2, Math.round(this.pos.y + 13), 4, 3, '#ff3b3b');
    }
    if (dazed) {
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
    super({ x: x - 8, y: floorY - 8, w: 16, h: 8, z: 4, tags: ['enemy', 'boss_fx'] });
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

const GOO_FLIGHT = 1.0;
const GOO_GRAVITY = 600;
const SHADOW_LEAD = 0.5;

/** Goo lobbed in an arc at Hop's position; its shadow shows the landing spot 0.5 s ahead; splashes 1 tile wide (§6.3). */
export class GooBlob extends Entity {
  constructor(x, y, targetX, floorY) {
    super({ x: x - 5, y: y - 4, w: 10, h: 8, z: 6, tags: ['enemy', 'boss_fx'] });
    this.targetX = targetX;
    this.floorY = floorY;
    this.vel.set((targetX - x) / GOO_FLIGHT, (floorY - 4 - y - 0.5 * GOO_GRAVITY * GOO_FLIGHT ** 2) / GOO_FLIGHT);
    this.left = GOO_FLIGHT;
    sfx('goo_lob');
  }

  update(dt) {
    this.vel.y += GOO_GRAVITY * dt;
    super.update(dt);
    this.left -= dt;
    if (this.left > 0) return;
    sfx('goo_splash');
    this.scene.burst(this.targetX, this.floorY - 2, '#8fd14f', 10);
    const p = this.scene.player;
    if (Math.abs(p.cx - this.targetX) < T + p.w / 2 && p.pos.y + p.h > this.floorY - T) p.hurt(this.targetX);
    this.destroy();
  }

  render(r) {
    if (this.left <= SHADOW_LEAD) {
      const k = 1 - this.left / SHADOW_LEAD;
      r.rect(Math.round(this.targetX - 4 - k * 8), this.floorY - 2, Math.round(8 + k * 16), 2, 'rgba(20,40,10,0.6)');
    }
    r.sprite(characters().frame(FRAMES.goo), Math.round(this.cx), Math.round(this.pos.y + this.h + 4));
  }
}

const ROCK_TELL = 0.6;

/** A ceiling rock shaken loose by the wall slam. Shadow tell 0.6 s before it drops (§6.3). */
export class FallingRock extends Entity {
  constructor(x, ceilingY, floorY) {
    super({ x: x - 6, y: ceilingY, w: 12, h: 12, z: 6, tags: ['boss_fx'] });
    this.floorY = floorY;
    this.tell = ROCK_TELL;
    this.noCull = true; // its shadow tell is drawn on the floor, far below its bounds
  }

  update(dt) {
    if (this.tell > 0) {
      this.tell -= dt;
      if (this.tell <= 0) this.tag('enemy');
      return;
    }
    this.vel.y = Math.min(this.vel.y + G * dt, 500);
    super.update(dt);
    if (this.pos.y + this.h >= this.floorY) {
      this.scene.burst(this.cx, this.floorY - 2, '#a898b8', 8);
      this.destroy();
    }
  }

  render(r) {
    const k = this.tell > 0 ? 1 - this.tell / ROCK_TELL : 1;
    r.rect(Math.round(this.cx - 3 - k * 5), this.floorY - 2, Math.round(6 + k * 10), 2, 'rgba(0,0,0,0.5)');
    if (this.tell <= 0) r.sprite(characters().frame(FRAMES.rock), Math.round(this.cx), Math.round(this.pos.y + this.h + 2));
    else r.rect(Math.round(this.cx - 2), Math.round(this.pos.y), 4, 2, '#7a6a8a'); // pebbles trickling
  }
}

/** The Sun Seed spat out by the deflated King. Touch it to win (§6.5). */
export class SunSeed extends Entity {
  constructor(x, y) {
    super({ x: x - 6, y: y - 6, w: 12, h: 12, z: 6, tags: ['seed'] });
    this.vel.set(0, -220);
    this.t = 0;
    this.landed = false;
    this.dropTimer = Infinity;
    sfx('seed');
  }

  update(dt) {
    this.t += dt;
    if (this.landed) return;
    this.vel.y = Math.min(this.vel.y + G * dt, 300);
    this.landed = this.scene.level.moveAndCollide(this, dt).ground;
  }

  render(r) {
    const glow = 10 + Math.sin(this.t * 5) * 2;
    r.circle(this.cx, this.cy, glow, 'rgba(255,210,63,0.3)');
    r.sprite(characters().frame(FRAMES.seed), Math.round(this.cx), Math.round(this.pos.y + this.h + 2 + Math.sin(this.t * 3)));
  }
}

import { Collision, lerp, Pool, Rect, Scene } from '../../vendor/h3-engine.min.js';
import { SONGS } from '../audio/songs.js';
import {
  BOSS_ARENA_SILENCE, BOSS_ASSIST_OFFER_DEATHS, BOSS_HP, BOSS_SLOWMO, BUILT_LEVELS, CAMERA_LERP, CAMERA_LOOK_AHEAD, CAMERA_LOOK_LERP, CAMERA_OFFSET_Y,
  CHAIN_SCORES, JUMP, LEVELS, MAX_HEARTS, PAUSE, SCORE_CLEAR, SCORE_COIN, SCORE_GEM, SCORE_HEART_FULL,
  SCORE_TIME_BONUS, SHAKE_SCALE, SHAKE_STOMP, SPRING_SPEED, STOMP_BOUNCE, STOMP_BOUNCE_HELD, STOMP_REACH, T,
  THORNWATER_CAMERA_BIAS, VIEW_H, VIEW_W,
  WALL_JUMP_FROM_LEVEL, WORLDS,
} from '../config.js';
import { Bat, Dropper, GloopKnight, Hopper, Puffer, Slime, Spore, Thornback } from '../entities/Enemy.js';
import { Acorn, Cannon, CrumbleBlock, Crystal, Switch, Thornwater, WindZone } from '../entities/mechanics.js';
import { Darkness } from '../world/Darkness.js';
import { FallingRock, GooBlob, KingGloop, Shockwave, SunSeed } from '../entities/KingGloop.js';
import { MovingPlatform } from '../entities/MovingPlatform.js';
import { Particle } from '../entities/Particle.js';
import { Coin, Gem, Heart } from '../entities/pickups.js';
import { Player } from '../entities/Player.js';
import { Banner, Checkpoint, Flag, Sign, Spring } from '../entities/props.js';
import { levelRecord, loadSave, writeSave } from '../save.js';
import { sfx } from '../sfx.js';
import { Run } from '../telemetry.js';
import { drawHud } from '../ui/hud.js';
import { label } from '../ui/label.js';
import { Backdrop } from '../world/Backdrop.js';
import { FakeWalls } from '../world/FakeWalls.js';
import { Level } from '../world/Level.js';

const COIN_CHAIN_WINDOW = 0.4;
const CLEAR_DELAY = 1.2;
const PAUSE_DUCK = 0.7;
const WATCHES = ['vel', 'state', 'ground', 'wall', 'hearts', 'boss'];
const ENEMIES = { e: Slime, h: Hopper, k: GloopKnight, t: Thornback, b: Bat, d: Dropper, p: Puffer };

/** Next level in play order if it exists in this build. */
const nextBuilt = (id) => {
  const i = LEVELS.indexOf(id);
  const next = i >= 0 ? LEVELS[i + 1] : undefined;
  return next && BUILT_LEVELS.includes(next) ? next : null;
};

/** Takes `{ level }`: a level id from BUILT_LEVELS or EXTRA_LEVELS. */
export class PlayScene extends Scene {
  preload(assets, { level = LEVELS[0] } = {}) {
    return assets.load({ json: { [`level-${level}`]: `levels/${level}.json` } }); // keys already loaded are skipped
  }

  enter({ level = LEVELS[0] } = {}) {
    const { assets, renderer, game } = this.ctx;
    this.levelId = String(level);
    this.def = assets.json(`level-${this.levelId}`);
    this.save = loadSave();
    this.record = levelRecord(this.save, this.levelId);
    const palette = WORLDS[this.def.world ?? 1];
    renderer.background = palette.sky;

    this.add(new Backdrop(palette));
    this.level = this.add(new Level(this.def));
    if (this.level.unknown.size > 0) console.warn(`Level ${this.levelId}: tiles not implemented yet: ${[...this.level.unknown].join(' ')}`);

    // Platforms first: they must move before anything that rides them.
    this.arena = null;
    this.boss = null;
    this.winds = [];
    this.thornwaters = [];
    for (const obj of this.def.objects ?? []) {
      if (obj.type === 'wind') this.winds.push(this.add(new WindZone(obj)));
      else if (obj.type === 'thornwater') this.thornwaters.push(this.add(new Thornwater(obj, this.level.h)));
      else if (obj.type === 'platform') this.level.platforms.push(this.add(new MovingPlatform(obj)));
      else if (obj.type === 'sign') this.add(new Sign(obj.x * T, obj.y * T, obj.text));
      else if (obj.type === 'banner') this.add(new Banner(obj.x * T, obj.y * T));
      else if (obj.type === 'arena') {
        this.arena = new Rect(obj.x * T, obj.y * T, obj.w * T, obj.h * T);
        this.arenaDoor = obj.door; // tiles that close behind Hop: { x, y, h }
      } else if (obj.type === 'boss') this.boss = this.add(new KingGloop((obj.x + 0.5) * T, (obj.y + 1) * T));
    }

    this.coinTotal = 0;
    this.gemTotal = 0;
    this.checkpoints = [];
    this.crumbles = [];
    this.acorns = new Pool(() => new Acorn(), 12);
    this.spores = new Pool(() => new Spore(), 8);
    const world = this.level.world;
    let start = null;
    for (const { ch, x, y } of this.level.spawns) {
      if (ch === 'P') start = { x, y };
      else if (ENEMIES[ch]) this.add(new ENEMIES[ch](x, y));
      else if (ch === '=') {
        const block = this.add(new CrumbleBlock(x, y, world));
        this.level.solids.push(block);
        this.crumbles.push(block);
      }
      else if (ch === 's') this.level.solids.push(this.add(new Switch(x, y, world)));
      else if (ch === '*') this.add(new Crystal(x, y));
      else if (ch === '<' || ch === '>') this.add(new Cannon(x, y, ch === '<' ? -1 : 1, this.acorns));
      else if (ch === 'o') {
        this.add(new Coin(x, y));
        this.coinTotal++;
      } else if (ch === 'G') {
        const gem = this.add(new Gem(x, y, this.gemTotal));
        gem.ghost = this.record.gems[this.gemTotal] === true;
        this.gemTotal++;
      } else if (ch === 'H') this.add(new Heart(x, y));
      else if (ch === 'S') this.add(new Spring(x, y));
      else if (ch === 'C') this.checkpoints.push(this.add(new Checkpoint(x, y)));
      else if (ch === 'F') this.add(new Flag(x, y));
    }
    this.checkpoints.sort((a, b) => a.pos.x - b.pos.x);
    if (!start) throw new Error(`Level ${this.levelId} has no player start (P)`);

    const wallJump = this.def.abilities?.wallJump ?? Number(this.levelId) >= WALL_JUMP_FROM_LEVEL;
    const assist = this.save.options.assist;
    this.assisted = assist.speed < 1 || assist.hearts > MAX_HEARTS || assist.invincible;
    this.player = this.add(
      new Player(start.x, start.y, { wallJump, maxHearts: assist.hearts, invincible: assist.invincible, golden: this.save.golden === true }),
    );
    this.add(new FakeWalls(this.level));
    if (this.def.darkness) this.darkness = new Darkness(this.def.darkness);
    this.assistSpeed = assist.speed;
    this.reduceFlashing = this.save.options.flashing === 'reduced';
    this.player.reduceFlashing = this.reduceFlashing;
    this.slowMo = 0; // seconds of boss slow motion left
    this.applySpeed(0);
    this.respawnPoint = { x: this.player.pos.x, y: this.player.pos.y };
    this.checkpointIndex = -1;

    this.run = new Run(this.levelId); // playtest telemetry (§11)
    this.state = 'play'; // 'play' | 'clear'
    this.fight = 'none'; // 'none' | 'silence' | 'on' | 'won'
    this.time = 0;
    this.coins = 0;
    this.gems = [false, false, false]; // found this run
    this.deaths = 0;
    this.phaseDeaths = 0;
    this.score = 0;
    this.coinChain = 0;
    this.lastCoinAt = -1;
    this.lookAhead = 0;
    this.hud = { hearts: 0, coins: 0, coinTotal: 0, gems: [false, false, false], gemTotal: 0, time: 0, showTimer: true }; // reused every frame

    this.particles = new Pool(() => new Particle(), 60);
    this._onEnemy = (p, e) => this.touchEnemy(p, e);
    this._onPickup = (p, item) => this.collect(p, item);
    this._onSpring = (p, s) => this.touchSpring(p, s);
    this._onCheckpoint = (_p, c) => this.touchCheckpoint(c);
    this._onFlag = () => this.clearLevel();
    this._onSeed = () => this.victory();
    // Level 10 starts grey; taking the Sun Seed floods colour back in (§6.5).
    this.colour = { fill: this.boss ? 0 : 1 };
    this.captionText = '';
    this.captionTime = 0;
    this.assistOffered = false;

    this.camera.follow(this.player, { lerp: CAMERA_LERP, offsetY: CAMERA_OFFSET_Y });
    this.camera.setBounds(0, 0, this.level.w, this.level.h);
    this.camera.roundPixels = true;
    this.camera.snap();

    // Music fades in at level start and keeps playing through deaths (§8.3).
    const music = SONGS[this.def.music] ? this.def.music : 'music_hills';
    game.jukebox.play(music, { fadeIn: 0.5 });

    // The engine pauses while the tab is hidden; open the pause menu when it comes back (§9.4).
    this._offHidden = game.events.on('hidden', () => (this.pauseOnReturn = true));

    const p = this.player;
    game.debug.watch('vel', () => `${p.vel.x.toFixed(0)},${p.vel.y.toFixed(0)}`);
    game.debug.watch('state', () => `${p.state}${p.sliding ? ' slide' : ''}${p.dropTimer > 0 ? ' drop' : ''}`);
    game.debug.watch('ground', () => `${p.onGround}${p.platform ? ' (platform)' : ''} coyote ${Math.max(0, p.coyote).toFixed(2)}`);
    game.debug.watch('wall', () => `side ${p.wallSide} coyote ${Math.max(0, p.wallCoyote).toFixed(2)}`);
    game.debug.watch('hearts', () => `${p.hearts} deaths ${this.deaths} score ${this.score}`);
    if (this.boss) game.debug.watch('boss', () => `${this.boss.state} hp ${this.boss.hp} phase ${this.boss.phase}`);
  }

  exit() {
    // Leaving mid-level (restart, quit) still counts as a run for the playtest data.
    if (this.state === 'play') this.run.finish(false, this.assisted);
    this._offHidden();
    for (const w of WATCHES) this.ctx.game.debug.unwatch(w);
  }

  update(dt, { input }) {
    this.applySpeed(dt);
    // Options can change mid-level from the pause menu, so this is read every step (§9.5).
    this.camera.shakeScale = SHAKE_SCALE[this.save.options.shake] ?? 1;
    if (this.state === 'play') {
      this.time += dt;
      this.run.tick(dt);
    }
    if (this.captionTime > 0) this.captionTime -= dt;
    if (this.state === 'play' && (input.justPressed(PAUSE) || this.pauseOnReturn)) {
      this.pauseOnReturn = false;
      sfx('pause');
      this.game.mixer.hold(PAUSE_DUCK);
      this.game.scenes.push('pause');
      return;
    }

    // Look ahead in the facing direction so landings are visible before committing (§5.1).
    this.lookAhead = lerp(this.lookAhead, this.player.facing * CAMERA_LOOK_AHEAD, CAMERA_LOOK_LERP);
    this.camera.offsetX = this.fight === 'none' ? Math.round(this.lookAhead) : 0;
    // Bias the camera upward while thornwater rises, keeping the water at the bottom edge (§5.4 level 9).
    const rising = this.thornwaters.some((w) => w.rising && w.pos.y > w.stopY);
    this.camera.offsetY = lerp(this.camera.offsetY, rising ? THORNWATER_CAMERA_BIAS : CAMERA_OFFSET_Y, 0.05);

    if (this.arena && this.fight === 'none' && this.player.pos.x > this.arena.x + 2 * T) this.enterArena();

    if (this.player.state !== 'play') return;
    Collision.check(this, 'player', 'enemy', this._onEnemy);
    Collision.check(this, 'player', 'pickup', this._onPickup);
    Collision.check(this, 'player', 'spring', this._onSpring);
    Collision.check(this, 'player', 'checkpoint', this._onCheckpoint);
    Collision.check(this, 'player', 'flag', this._onFlag);
    Collision.check(this, 'player', 'seed', this._onSeed);
  }

  /** Stomp when falling onto the enemy's top; any other contact hurts (§4.3). */
  touchEnemy(p, enemy) {
    if (enemy.dead || p.state !== 'play') return;
    if (enemy.has('boss')) {
      enemy.touch(p);
      return;
    }
    const stomp = enemy.has('stompable') && p.vel.y > 0 && p.pos.y + p.h - enemy.pos.y < STOMP_REACH;
    if (!stomp) {
      if (p.hurt(enemy.cx)) enemy.hitPlayer = true;
      return;
    }
    const { input } = this.ctx;
    enemy.onStomp();
    p.chain++;
    // Acorns bounce Hop but score nothing (§4.3).
    if (enemy.score > 0) this.score += Math.max(enemy.score, CHAIN_SCORES[Math.min(p.chain, CHAIN_SCORES.length) - 1]);
    p.pos.y = enemy.pos.y - p.h;
    p.bounce(input.isDown(JUMP) ? STOMP_BOUNCE_HELD : STOMP_BOUNCE);
    this.camera.shake(SHAKE_STOMP, 0.15);
    sfx('stomp', { semitones: (p.chain - 1) * 2 });
    this.burst(enemy.cx, enemy.cy, '#a6ec8f', 8);
  }

  collect(p, item) {
    if (item.dead) return;
    item.destroy();
    if (item.kind === 'coin') {
      this.coins++;
      this.score += SCORE_COIN;
      // +1 semitone per coin within 0.4 s, up to +12 (§8.4).
      this.coinChain = this.time - this.lastCoinAt < COIN_CHAIN_WINDOW ? (this.coinChain + 1) % 13 : 0;
      this.lastCoinAt = this.time;
      sfx('coin', { semitones: this.coinChain });
      this.burst(item.cx, item.cy, '#fff6b0', 4, { speed: 40, up: 30, gravity: 0 });
    } else if (item.kind === 'gem') {
      this.gems[item.index] = true;
      this.score += SCORE_GEM;
      sfx('gem');
      this.burst(item.cx, item.cy, '#ffb627', 12, { speed: 60, up: 40, gravity: 60 });
      // A gem counts even if the level isn't cleared (§9.6).
      this.record.gems[item.index] = true;
      writeSave(this.save);
    } else if (item.kind === 'heart') {
      if (p.hearts < MAX_HEARTS) p.hearts++;
      else this.score += SCORE_HEART_FULL;
      sfx('heart');
      this.burst(item.cx, item.cy, '#ff5e7a', 6, { speed: 40, up: 40, gravity: 60 });
    }
  }

  touchSpring(p, spring) {
    if (p.vel.y < 0 || p.pos.y + p.h - spring.pos.y > 8) return;
    p.pos.y = spring.pos.y - p.h;
    p.bounce(SPRING_SPEED);
    spring.squish = 0.15;
    sfx('spring');
  }

  /** Lighting a later lantern deactivates earlier ones (§4.2). */
  touchCheckpoint(c) {
    const index = this.checkpoints.indexOf(c);
    if (index <= this.checkpointIndex) return;
    for (const other of this.checkpoints) other.lit = false;
    c.lit = true;
    this.checkpointIndex = index;
    this.run.checkpoint();
    this.respawnPoint = { x: c.spawnX, y: c.spawnY };
    sfx('checkpoint');
    this.burst(c.cx, c.pos.y + 10, '#ffe27a', 10, { speed: 50, up: 40, gravity: 40 });
  }

  addScore(n) {
    this.score += n;
  }

  fireSpore(x, y, vx, vy) {
    this.add(this.spores.get().fire(x, y, vx, vy, this.spores));
  }

  /**
   * Swap red and blue blocks. A block turning solid around Hop pushes him up; if he can't move up, he's crushed
   * (levels are built so that never happens, §4.2).
   */
  toggleSwitchBlocks() {
    const level = this.level;
    const p = this.player;
    level.toggleSwitchBlocks();
    sfx('switch');
    sfx('blocks_on');
    this.camera.shake(1, 0.1);
    if (!level.overlapsSolid(p)) return;
    const y = p.pos.y;
    for (let up = 1; up <= T; up++) {
      p.pos.y = y - up;
      if (!level.overlapsSolid(p)) return;
    }
    p.pos.y = y;
    p.drown();
  }

  // --- Boss arena (§6) ---

  /** Close the doors, lock the camera, 1.5 s of silence and a drone, then the roar (§8.3). */
  enterArena() {
    const { x, y, h } = this.arenaDoor;
    for (let r = y; r < y + h; r++) this.level.setTile(x, r, '#');
    this.camera.setBounds(this.arena.x, this.arena.y, this.arena.w, this.arena.h);
    this.respawnPoint = { x: this.player.pos.x, y: this.player.pos.y };
    this.fight = 'silence';
    this.game.jukebox.stop(0.3);
    this.timer.after(BOSS_ARENA_SILENCE, () => {
      this.game.jukebox.play('music_drone');
      this.game.scenes.push('boss_intro', { firstTime: !this.save.bossIntroSeen });
      this.save.bossIntroSeen = true;
      writeSave(this.save);
    });
  }

  startFight() {
    this.fight = 'on';
    this.boss.start(true);
  }

  onBossRoared() {
    this.caption('[King Gloop bellows]');
    this.game.jukebox.play('music_boss');
  }

  spawnShockwaves(x, floorY) {
    this.add(new Shockwave(x - 20, floorY, -1));
    this.add(new Shockwave(x + 20, floorY, 1));
    sfx('shockwave');
  }

  /** Phase 2: a Slime arcing from the King's mouth to land at `landX` (§6.3). */
  spawnMinion(x, y, landX) {
    const flight = 0.8;
    const floorY = this.arena.y + this.arena.h - T;
    const vy = (floorY - 10 - y - 0.5 * 900 * flight ** 2) / flight;
    const slime = this.add(new Slime(x - 8, y - 6).launch((landX - x) / flight, vy));
    slime.tag('minion').tag('boss_fx');
  }

  lobGoo(x, y, targetX) {
    const floorY = this.arena.y + this.arena.h - T;
    const clamped = Math.max(this.arena.x + 1.5 * T, Math.min(this.arena.x + this.arena.w - 1.5 * T, targetX));
    this.add(new GooBlob(x, y, clamped, floorY));
  }

  /** Phase 3 wall slam: rocks in the given arena columns, each with a shadow tell. */
  dropRocks(cols) {
    const floorY = this.arena.y + this.arena.h - T;
    for (const col of cols) this.add(new FallingRock(this.arena.x + col * T + T / 2, this.arena.y + T, floorY));
    sfx('rock_tell');
  }

  /** Phase transitions (§6.3): a heart for phase 2; spikes, faster music and faster King for phase 3. */
  onBossPhase(phase) {
    this.phaseDeaths = 0;
    this.assistOffered = false;
    this.clearBossFx();
    const ax = this.arena.x / T;
    const floorRow = (this.arena.y + this.arena.h) / T - 2;
    if (phase === 2) {
      this.add(new Heart(this.arena.x + 3 * T, this.arena.y + 4 * T));
      this.caption('[King Gloop roars: "GUARDS!"]');
    } else if (phase === 3) {
      for (const c of [1, 2, 17, 18]) this.level.setTile(ax + c, floorRow, '^');
      this.game.jukebox.play('music_boss_final');
      this.caption('[King Gloop throws a tantrum]');
    }
  }

  clearBossFx() {
    for (const e of this.find('boss_fx')) e.destroy();
  }

  /** Final hit: slow motion while he deflates (§6.3). */
  onBossBeaten() {
    this.fight = 'won';
    this.clearBossFx();
    this.slowMo = BOSS_SLOWMO;
    this.applySpeed(0);
    this.game.jukebox.stop(0.5);
  }

  onBossDefeated(x, y) {
    this.add(new SunSeed(x, y));
  }

  /** Hop takes the Sun Seed: colour floods back across the screen, then the ending (§6.5). */
  victory() {
    if (this.state !== 'play') return;
    this.run.finish(true, this.assisted);
    this.state = 'victory';
    this.player.state = 'clear';
    for (const seed of this.find('seed')) seed.destroy();
    this.game.jukebox.play('jingle_victory', { restart: true });
    this.tween(this.colour, { fill: 1 }, 2.5, 'quadInOut');
    const rec = this.record;
    rec.cleared = true;
    rec.bestTime = rec.bestTime === null ? this.time : Math.min(rec.bestTime, this.time);
    rec.allCoins ||= this.coins === this.coinTotal;
    rec.deaths = this.deaths;
    this.save.bossBeaten = true;
    writeSave(this.save);
    this.timer.after(5, () => this.game.scenes.switch('ending', { time: this.time, deaths: this.deaths, assisted: this.assisted }));
  }

  /** Optional caption line for boss cues (§9.5). */
  caption(text) {
    if (!this.save.options.captions) return;
    this.captionText = text;
    this.captionTime = 2.5;
  }

  // --- Death and respawn ---

  onPlayerDied() {
    this.deaths++;
    this.run.death();
    if (this.fight === 'on') this.phaseDeaths++;
    this.burst(this.player.cx, this.player.cy, '#ff5e5b', 14);
  }

  /** Back to the last checkpoint with full hearts. Coins and gems collected since then are kept (§3.4). */
  respawn() {
    if (this.fight === 'on' && this.phaseDeaths >= BOSS_ASSIST_OFFER_DEATHS && !this.assistOffered && !this.assisted) {
      // After 5 deaths in one phase, offer Assist Mode once. Never force it (§6.4).
      this.assistOffered = true;
      this.game.scenes.push('assist');
    }
    this.player.revive(this.respawnPoint.x, this.respawnPoint.y);
    for (const water of this.thornwaters) water.reset();
    for (const block of this.crumbles) block.reset();
    this.camera.snap();
    if (this.fight === 'on') {
      // Restart the current phase, skipping its intro (§6.4).
      this.clearBossFx();
      this.boss.restartPhase();
      this.timer.after(1, () => this.boss.start(false));
    }
  }

  clearLevel() {
    if (this.state !== 'play') return;
    this.run.finish(true, this.assisted);
    this.state = 'clear';
    this.player.state = 'clear';
    this.game.jukebox.play('jingle_clear', { restart: true });
    const par = this.def.par ?? 0;
    const timeBonus = par > 0 ? Math.floor(Math.max(0, par - this.time) * SCORE_TIME_BONUS) : 0;
    this.score += SCORE_CLEAR + timeBonus;

    const rec = this.record;
    rec.cleared = true;
    rec.bestTime = rec.bestTime === null ? this.time : Math.min(rec.bestTime, this.time);
    rec.allCoins ||= this.coins === this.coinTotal;
    rec.parTime ||= par > 0 && this.time <= par;
    rec.deaths = this.deaths;
    const order = LEVELS.indexOf(this.levelId);
    if (order >= 0) this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, order + 2));
    writeSave(this.save);

    const stats = {
      levelId: this.levelId,
      name: this.def.name,
      next: nextBuilt(this.levelId),
      time: this.time,
      par,
      coins: this.coins,
      coinTotal: this.coinTotal,
      gems: this.gems.slice(),
      gemTotal: this.gemTotal,
      deaths: this.deaths,
      score: this.score,
      timeBonus,
      assisted: this.assisted,
    };
    this.timer.after(CLEAR_DELAY, () => this.game.scenes.push('clear', stats));
  }

  /** Pause menu results. */
  resume(action) {
    this.game.mixer.unduck();
    // Options may have changed while paused; nothing in the save is pending, so reload it.
    this.save = loadSave();
    this.record = levelRecord(this.save, this.levelId);
    if (action === 'boss_intro') this.startFight();
    else if (action === 'assist') this.applyAssist();
    else if (action === 'checkpoint') this.respawn();
    else if (action === 'restart') this.game.scenes.switch('play', { level: this.levelId });
    else if (action === 'map') this.game.scenes.switch('select', { level: this.levelId });
    else if (action === 'skip') this.skipLevel();
  }

  /** Assist "skip level": counts as a clear (marked assisted); skipping the boss goes straight to the victory. */
  skipLevel() {
    this.assisted = true;
    if (this.boss) {
      this.clearBossFx();
      this.boss.state = 'gone';
      this.victory();
    } else {
      this.clearLevel();
    }
  }

  /** Assist Mode turned on mid-level (from the offer after repeated boss deaths). */
  applyAssist() {
    const assist = this.save.options.assist;
    this.assistSpeed = assist.speed;
    this.applySpeed(0);
    this.player.maxHearts = assist.hearts;
    this.player.hearts = assist.hearts;
    this.player.invincible = assist.invincible;
    this.assisted = assist.speed < 1 || assist.hearts > MAX_HEARTS || assist.invincible;
  }

  dust(x, y, n) {
    this.burst(x, y, '#f0e6d2', n, { speed: 30, up: 20, gravity: 100 });
  }

  burst(x, y, color, n, opts) {
    for (let i = 0; i < n; i++) this.add(this.particles.get().spawn(x, y, color, this.particles, opts));
  }

  /** Game speed: Assist Mode (§9.5) times boss slow motion (§6.3). `dt` is already scaled, so slow motion counts down in real time. */
  applySpeed(dt) {
    if (this.slowMo > 0) this.slowMo -= dt / this.timeScale;
    this.timeScale = this.assistSpeed * (this.slowMo > 0 ? 0.3 : 1);
  }

  render(r) {
    this.darkness?.render(r, this);
    if (this.colour.fill < 1) {
      // Hopshire is grey while the King holds the Sun Seed; colour sweeps back in from the left (§6.5).
      const x = Math.round(this.colour.fill * VIEW_W);
      r.rect(x, 0, VIEW_W - x, VIEW_H, 'rgba(112,96,80,0.45)');
      if (this.colour.fill > 0) r.rect(x - 2, 0, 2, VIEW_H, 'rgba(255,240,180,0.8)');
    }
    if (this.captionTime > 0) {
      r.rect(0, VIEW_H - 18, VIEW_W, 14, 'rgba(0,0,0,0.6)');
      label(r, this.captionText, VIEW_W / 2, VIEW_H - 15);
    }
    if (this.state === 'clear' || this.state === 'victory') return;
    const hud = this.hud;
    hud.hearts = this.player.hearts;
    hud.coins = this.coins;
    hud.coinTotal = this.coinTotal;
    hud.gemTotal = this.gemTotal;
    hud.time = this.time;
    hud.showTimer = this.save.options.timer !== false;
    for (let i = 0; i < 3; i++) hud.gems[i] = this.gems[i] || this.record.gems[i];
    drawHud(r, hud);
    if (this.fight === 'on' || this.fight === 'won') this.drawBossBar(r);
  }

  /** Six segments, top centre (§9.2). */
  drawBossBar(r) {
    const seg = 14;
    const x0 = Math.round(VIEW_W / 2 - (BOSS_HP * (seg + 2)) / 2);
    label(r, 'KING GLOOP', VIEW_W / 2, 18);
    for (let i = 0; i < BOSS_HP; i++) {
      const x = x0 + i * (seg + 2);
      r.rect(x, 28, seg, 5, 'rgba(0,0,0,0.5)');
      if (i < this.boss.hp) r.rect(x + 1, 29, seg - 2, 3, '#9be36b');
    }
  }
}

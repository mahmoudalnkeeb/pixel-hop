import { Collision, lerp, Pool, Scene } from '../../vendor/h3-engine.min.js';
import {
  CAMERA_LERP, CAMERA_LOOK_AHEAD, CAMERA_LOOK_LERP, CAMERA_OFFSET_Y, CHAIN_SCORES, EXTRA_LEVELS, JUMP, LEVELS,
  MAX_HEARTS, PAUSE, SCORE_CLEAR, SCORE_COIN, SCORE_GEM, SCORE_HEART_FULL, SCORE_TIME_BONUS, SHAKE_STOMP,
  SPRING_SPEED, STOMP_BOUNCE, STOMP_BOUNCE_HELD, STOMP_REACH, WALL_JUMP_FROM_LEVEL, WORLDS,
} from '../config.js';
import { Slime } from '../entities/Enemy.js';
import { MovingPlatform } from '../entities/MovingPlatform.js';
import { Particle } from '../entities/Particle.js';
import { Coin, Gem, Heart } from '../entities/pickups.js';
import { Player } from '../entities/Player.js';
import { Checkpoint, Flag, Sign, Spring } from '../entities/props.js';
import { levelRecord, loadSave, writeSave } from '../save.js';
import { fanfare, sfx } from '../sfx.js';
import { drawHud } from '../ui/hud.js';
import { Backdrop } from '../world/Backdrop.js';
import { FakeWalls } from '../world/FakeWalls.js';
import { Level } from '../world/Level.js';

const COIN_CHAIN_WINDOW = 0.4;
const CLEAR_DELAY = 1.2;
const WATCHES = ['vel', 'state', 'ground', 'wall', 'hearts'];

/** Takes `{ level }`: a level id from LEVELS or EXTRA_LEVELS. */
export class PlayScene extends Scene {
  preload(assets) {
    const json = {};
    for (const id of [...LEVELS, ...EXTRA_LEVELS]) json[`level-${id}`] = `levels/${id}.json`;
    return assets.load({ json }); // keys already loaded are skipped
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
    for (const obj of this.def.objects ?? []) {
      if (obj.type === 'platform') this.level.platforms.push(this.add(new MovingPlatform(obj)));
      else if (obj.type === 'sign') this.add(new Sign(obj.x * 16, obj.y * 16, obj.text));
    }

    this.coinTotal = 0;
    this.checkpoints = [];
    let gemIndex = 0;
    let start = null;
    for (const { ch, x, y } of this.level.spawns) {
      if (ch === 'P') start = { x, y };
      else if (ch === 'e') this.add(new Slime(x, y));
      else if (ch === 'o') {
        this.add(new Coin(x, y));
        this.coinTotal++;
      } else if (ch === 'G') {
        const gem = this.add(new Gem(x, y, gemIndex));
        gem.ghost = this.record.gems[gemIndex] === true;
        gemIndex++;
      } else if (ch === 'H') this.add(new Heart(x, y));
      else if (ch === 'S') this.add(new Spring(x, y));
      else if (ch === 'C') this.checkpoints.push(this.add(new Checkpoint(x, y)));
      else if (ch === 'F') this.add(new Flag(x, y));
    }
    this.checkpoints.sort((a, b) => a.pos.x - b.pos.x);
    if (!start) throw new Error(`Level ${this.levelId} has no player start (P)`);

    const wallJump = this.def.abilities?.wallJump ?? Number(this.levelId) >= WALL_JUMP_FROM_LEVEL;
    this.player = this.add(new Player(start.x, start.y, { wallJump }));
    this.add(new FakeWalls(this.level));
    this.respawnPoint = { x: this.player.pos.x, y: this.player.pos.y };
    this.checkpointIndex = -1;

    this.state = 'play'; // 'play' | 'clear'
    this.time = 0;
    this.coins = 0;
    this.gems = [false, false, false]; // found this run
    this.deaths = 0;
    this.score = 0;
    this.coinChain = 0;
    this.lastCoinAt = -1;
    this.lookAhead = 0;
    this.hud = { hearts: 0, coins: 0, coinTotal: 0, gems: [false, false, false], time: 0 }; // reused every frame

    this.particles = new Pool(() => new Particle(), 60);
    this._onEnemy = (p, e) => this.touchEnemy(p, e);
    this._onPickup = (p, item) => this.collect(p, item);
    this._onSpring = (p, s) => this.touchSpring(p, s);
    this._onCheckpoint = (_p, c) => this.touchCheckpoint(c);
    this._onFlag = () => this.clearLevel();

    this.camera.follow(this.player, { lerp: CAMERA_LERP, offsetY: CAMERA_OFFSET_Y });
    this.camera.setBounds(0, 0, this.level.w, this.level.h);
    this.camera.roundPixels = true;
    this.camera.snap();

    // The engine pauses while the tab is hidden; open the pause menu when it comes back (§9.4).
    this._onVisibility = () => {
      if (document.hidden) this.pauseOnReturn = true;
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    const p = this.player;
    game.debug.watch('vel', () => `${p.vel.x.toFixed(0)},${p.vel.y.toFixed(0)}`);
    game.debug.watch('state', () => `${p.state}${p.sliding ? ' slide' : ''}${p.dropTimer > 0 ? ' drop' : ''}`);
    game.debug.watch('ground', () => `${p.onGround}${p.platform ? ' (platform)' : ''} coyote ${Math.max(0, p.coyote).toFixed(2)}`);
    game.debug.watch('wall', () => `side ${p.wallSide} coyote ${Math.max(0, p.wallCoyote).toFixed(2)}`);
    game.debug.watch('hearts', () => `${p.hearts} deaths ${this.deaths} score ${this.score}`);
  }

  exit() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    for (const w of WATCHES) this.ctx.game.debug.unwatch(w);
  }

  update(dt, { input, audio }) {
    if (this.state === 'play') this.time += dt;
    if (this.state === 'play' && (input.justPressed(PAUSE) || this.pauseOnReturn)) {
      this.pauseOnReturn = false;
      sfx(audio, 'pause');
      this.game.scenes.push('pause');
      return;
    }

    // Look ahead in the facing direction so landings are visible before committing (§5.1).
    this.lookAhead = lerp(this.lookAhead, this.player.facing * CAMERA_LOOK_AHEAD, CAMERA_LOOK_LERP);
    this.camera.offsetX = Math.round(this.lookAhead);

    if (this.player.state !== 'play') return;
    Collision.check(this, 'player', 'enemy', this._onEnemy);
    Collision.check(this, 'player', 'pickup', this._onPickup);
    Collision.check(this, 'player', 'spring', this._onSpring);
    Collision.check(this, 'player', 'checkpoint', this._onCheckpoint);
    Collision.check(this, 'player', 'flag', this._onFlag);
  }

  /** Stomp when falling onto the enemy's top; any other contact hurts (§4.3). */
  touchEnemy(p, enemy) {
    if (enemy.dead || p.state !== 'play') return;
    const stomp = enemy.has('stompable') && p.vel.y > 0 && p.pos.y + p.h - enemy.pos.y < STOMP_REACH;
    if (!stomp) {
      p.hurt(enemy.cx);
      return;
    }
    const { audio, input } = this.ctx;
    enemy.onStomp();
    p.chain++;
    this.score += Math.max(enemy.score, CHAIN_SCORES[Math.min(p.chain, CHAIN_SCORES.length) - 1]);
    p.pos.y = enemy.pos.y - p.h;
    p.bounce(input.isDown(JUMP) ? STOMP_BOUNCE_HELD : STOMP_BOUNCE);
    this.camera.shake(SHAKE_STOMP, 0.15);
    sfx(audio, 'stomp', { semitones: (p.chain - 1) * 2 });
    this.burst(enemy.cx, enemy.cy, '#4fbf3f', 8);
  }

  collect(p, item) {
    if (item.dead) return;
    const { audio } = this.ctx;
    item.destroy();
    if (item.kind === 'coin') {
      this.coins++;
      this.score += SCORE_COIN;
      // +1 semitone per coin within 0.4 s, up to +12 (§8.4).
      this.coinChain = this.time - this.lastCoinAt < COIN_CHAIN_WINDOW ? (this.coinChain + 1) % 13 : 0;
      this.lastCoinAt = this.time;
      sfx(audio, 'coin', { semitones: this.coinChain });
      this.burst(item.cx, item.cy, '#fff6b0', 4, { speed: 40, up: 30, gravity: 0 });
    } else if (item.kind === 'gem') {
      this.gems[item.index] = true;
      this.score += SCORE_GEM;
      sfx(audio, 'gem', { timer: this.timer });
      this.burst(item.cx, item.cy, '#ffb627', 12, { speed: 60, up: 40, gravity: 60 });
      // A gem counts even if the level isn't cleared (§9.6).
      this.record.gems[item.index] = true;
      writeSave(this.save);
    } else if (item.kind === 'heart') {
      if (p.hearts < MAX_HEARTS) p.hearts++;
      else this.score += SCORE_HEART_FULL;
      sfx(audio, 'heart');
      this.burst(item.cx, item.cy, '#ff5e7a', 6, { speed: 40, up: 40, gravity: 60 });
    }
  }

  touchSpring(p, spring) {
    if (p.vel.y < 0 || p.pos.y + p.h - spring.pos.y > 8) return;
    p.pos.y = spring.pos.y - p.h;
    p.bounce(SPRING_SPEED);
    spring.squish = 0.15;
    sfx(this.ctx.audio, 'spring');
  }

  /** Lighting a later lantern deactivates earlier ones (§4.2). */
  touchCheckpoint(c) {
    const index = this.checkpoints.indexOf(c);
    if (index <= this.checkpointIndex) return;
    for (const other of this.checkpoints) other.lit = false;
    c.lit = true;
    this.checkpointIndex = index;
    this.respawnPoint = { x: c.spawnX, y: c.spawnY };
    sfx(this.ctx.audio, 'checkpoint', { timer: this.timer });
    this.burst(c.cx, c.pos.y + 10, '#ffe27a', 10, { speed: 50, up: 40, gravity: 40 });
  }

  onPlayerDied() {
    this.deaths++;
    this.burst(this.player.cx, this.player.cy, '#ff5e5b', 14);
  }

  /** Back to the last checkpoint with full hearts. Coins and gems collected since then are kept (§3.4). */
  respawn() {
    this.player.revive(this.respawnPoint.x, this.respawnPoint.y);
    this.camera.snap();
  }

  clearLevel() {
    if (this.state !== 'play') return;
    const { audio } = this.ctx;
    this.state = 'clear';
    this.player.state = 'clear';
    fanfare(this.timer, audio);
    const par = this.def.par ?? 0;
    const timeBonus = Math.floor(Math.max(0, par - this.time) * SCORE_TIME_BONUS);
    this.score += SCORE_CLEAR + timeBonus;

    const rec = this.record;
    const allCoins = this.coins === this.coinTotal;
    rec.cleared = true;
    rec.bestTime = rec.bestTime === null ? this.time : Math.min(rec.bestTime, this.time);
    rec.allCoins ||= allCoins;
    rec.deaths = this.deaths;
    const order = LEVELS.indexOf(this.levelId);
    if (order >= 0) this.save.unlocked = Math.max(this.save.unlocked, order + 2);
    writeSave(this.save);

    const next = order >= 0 && order + 1 < LEVELS.length ? LEVELS[order + 1] : null;
    const stats = {
      levelId: this.levelId,
      name: this.def.name,
      next,
      time: this.time,
      par,
      coins: this.coins,
      coinTotal: this.coinTotal,
      gems: this.gems.slice(),
      deaths: this.deaths,
      score: this.score,
      timeBonus,
    };
    this.timer.after(CLEAR_DELAY, () => this.game.scenes.push('clear', stats));
  }

  /** Pause menu results. */
  resume(action) {
    if (action === 'checkpoint') this.respawn();
    else if (action === 'restart') this.game.scenes.switch('play', { level: this.levelId });
    else if (action === 'quit') this.game.scenes.switch('title');
  }

  dust(x, y, n) {
    this.burst(x, y, '#f0e6d2', n, { speed: 30, up: 20, gravity: 100 });
  }

  burst(x, y, color, n, opts) {
    for (let i = 0; i < n; i++) this.add(this.particles.get().spawn(x, y, color, this.particles, opts));
  }

  render(r) {
    if (this.state === 'clear') return;
    const hud = this.hud;
    hud.hearts = this.player.hearts;
    hud.coins = this.coins;
    hud.coinTotal = this.coinTotal;
    hud.time = this.time;
    for (let i = 0; i < 3; i++) hud.gems[i] = this.gems[i] || this.record.gems[i];
    drawHud(r, hud);
  }
}

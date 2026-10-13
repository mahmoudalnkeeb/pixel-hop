import { Collision, Entity, Rect } from '../../vendor/h3-engine.min.js';
import { decor, decorCounts } from '../art/decor.js';
import { brickFrame, groundFrame, OPEN, tiles, TILE } from '../art/tiles.js';
import { hash2 } from '../art/paint.js';
import { T, WORLDS } from '../config.js';

// Characters that become entities; their tile is left empty (§4.1).
// `=` crumble and `s` switch become solid entities; `*` is a glowing cave crystal (light source).
const SPAWN_CHARS = 'PFCoGHSehktbdp=s*';
// Acorn cannons stay solid tiles and also spawn a cannon entity.
const TILE_AND_SPAWN = '<>';
// Tile characters the level draws and collides with itself.
const TILE_CHARS = '.#B-^%RU<>';
// Solid tiles Hop can wall-slide on (§4.2: never crumble or switch blocks).
const isWallTile = (t) => t === '#' || t === 'B';

const STRIP_COLS = 16; // level tiles are pre-rendered in strips this many columns wide
const STRIP_PX = STRIP_COLS * T;
const POCKET_MAX = 24; // cells; a bigger enclosed space behind a fake wall is a room, not a pocket
const UP = [[0, -1]];
const SIDEWAYS = [[1, 0], [-1, 0]];

/** ASCII tile map with per-axis collision, one-way platforms and moving-platform landings (GDD Appendix C.1). */
export class Level extends Entity {
  /** @param {{ map: string[], world?: number }} def */
  constructor(def) {
    const map = def.map;
    const cols = Math.max(...map.map((row) => row.length));
    super({ w: cols * T, h: map.length * T, z: 0, tags: ['level'] });
    this.debug = false;
    this.cols = cols;
    this.rows = map.length;
    this.world = def.world ?? 1;
    this.palette = WORLDS[this.world];
    this.spawns = []; // { ch, x, y } in pixels
    this.unknown = new Set();
    this.platforms = []; // moving platforms Hop can land on
    this.solids = []; // solid entities: crumble blocks and switches
    this.redOn = true; // red switch blocks start solid (§4.1)
    this.grid = map.map((line, r) =>
      [...line.padEnd(cols, '.')].map((ch, c) => {
        if (SPAWN_CHARS.includes(ch)) {
          this.spawns.push({ ch, x: c * T, y: r * T });
          return '.';
        }
        if (TILE_AND_SPAWN.includes(ch)) this.spawns.push({ ch, x: c * T, y: r * T });
        if (!TILE_CHARS.includes(ch)) this.unknown.add(ch);
        return ch;
      }),
    );
    this.cracked = new Set(); // one fake tile per secret wall shows a hairline crack (§5.3)
    this.fakeRegions = this._labelFakeRegions();
    this.frames = this._tileFrames();
    this.decor = this._decorFrames();
    this._tile = new Rect();
    this._hit = { wall: '', ground: false, ceiling: false, platform: null, groundSolid: null, ceilingSolid: null };
  }

  /** The left and right edges act as walls; above and below are open. */
  at(c, r) {
    if (c < 0 || c >= this.cols) return '#';
    if (r < 0 || r >= this.rows) return '.';
    return this.grid[r][c];
  }

  /** Change a tile at runtime (boss doors) and refresh the sprite frames around it. */
  setTile(c, r, ch) {
    this.grid[r][c] = ch;
    this.frames = this._tileFrames();
    this.decor = this._decorFrames();
    this.strips?.clear(); // autotiling around the change may differ; strips repaint on next draw
  }

  /** Is this tile character solid right now? */
  solidTile(t) {
    return t === '#' || t === 'B' || t === '<' || t === '>' || (t === 'R' && this.redOn) || (t === 'U' && !this.redOn);
  }

  isSolid(c, r) {
    return this.solidTile(this.at(c, r));
  }

  /** Swap red and blue switch blocks (§4.2). */
  toggleSwitchBlocks() {
    this.redOn = !this.redOn;
  }

  /** Does the entity overlap any solid tile? (Switch blocks turning solid around Hop.) */
  overlapsSolid(e) {
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    const r0 = Math.floor(e.pos.y / T);
    const r1 = Math.floor((e.pos.y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.isSolid(c, r)) return true;
    return false;
  }

  /**
   * Move X then Y, pushing out of tiles and landing on moving platforms.
   * Honours `e.dropTimer > 0` by ignoring one-way surfaces, and `e.nudge` (px) for corner correction.
   * @returns {{ wall: string, ground: boolean, ceiling: boolean, platform: Entity | null }} Shared object.
   */
  moveAndCollide(e, dt) {
    const hit = this._hit;
    hit.wall = '';
    hit.ground = hit.ceiling = false;
    hit.platform = null;
    hit.groundSolid = hit.ceilingSolid = null;
    e.pos.x += e.vel.x * dt;
    // Feet clipping a ledge corner pop up onto it instead of stopping dead against the wall.
    if (e.nudge && this._blocked(e, e.pos.x, e.pos.y)) this._nudge(e, UP);
    this._collide(e, 'x', 0);
    const prevBottom = e.pos.y + e.h;
    e.pos.y += e.vel.y * dt;
    // A head bump on the edge of a ceiling tile slides past it instead of killing the jump.
    if (e.nudge && e.vel.y < 0 && this._blocked(e, e.pos.x, e.pos.y)) this._nudge(e, SIDEWAYS);
    this._collide(e, 'y', prevBottom);
    if (e.vel.y >= 0 && !(e.dropTimer > 0)) this._landOnPlatforms(e, prevBottom);
    return hit;
  }

  _collide(e, axis, prevBottom) {
    const hit = this._hit;
    const dropping = e.dropTimer > 0;
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    const r0 = Math.floor(e.pos.y / T);
    const r1 = Math.floor((e.pos.y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = this.at(c, r);
        let solid = this.solidTile(t);
        // One-way platforms only stop things falling onto them from above.
        if (t === '-' && !dropping && axis === 'y' && e.vel.y >= 0 && prevBottom <= r * T + 0.01) solid = true;
        if (!solid) continue;
        const side = Collision.resolve(e, this._tile.set(c * T, r * T, T, T), axis);
        if (!side) continue;
        if (axis === 'x') {
          e.vel.x = 0;
          hit.wall = side;
        } else if (side === 'top') {
          e.vel.y = 0;
          hit.ground = true;
        } else {
          if (e.vel.y < 0) e.vel.y = 0;
          hit.ceiling = true;
        }
      }
    }
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (!s.solid || s === e) continue;
      const side = Collision.resolve(e, s, axis);
      if (!side) continue;
      if (axis === 'x') {
        e.vel.x = 0;
        hit.wall = side;
      } else if (side === 'top') {
        e.vel.y = 0;
        hit.ground = true;
        hit.groundSolid = s;
      } else {
        if (e.vel.y < 0) e.vel.y = 0;
        hit.ceiling = true;
        hit.ceilingSolid = s;
      }
    }
  }

  /** Would the entity overlap a solid tile or solid entity at (x, y)? One-way surfaces don't count. */
  _blocked(e, x, y) {
    const c0 = Math.floor(x / T);
    const c1 = Math.floor((x + e.w - 0.001) / T);
    const r0 = Math.floor(y / T);
    const r1 = Math.floor((y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.isSolid(c, r)) return true;
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (s.solid && s !== e && x < s.pos.x + s.w && x + e.w > s.pos.x && y < s.pos.y + s.h && y + e.h > s.pos.y) return true;
    }
    return false;
  }

  /** Shift the entity to the nearest free spot up to `e.nudge` px along one of `dirs`, if there is one. */
  _nudge(e, dirs) {
    for (let d = 1; d <= e.nudge; d++) {
      for (const [dx, dy] of dirs) {
        const x = e.pos.x + dx * d;
        const y = e.pos.y + dy * d;
        if (this._blocked(e, x, y)) continue;
        e.pos.x = x;
        e.pos.y = y;
        return;
      }
    }
  }

  /** Moving platforms are solid on top only, like one-way tiles. */
  _landOnPlatforms(e, prevBottom) {
    const bottom = e.pos.y + e.h;
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (e.pos.x + e.w <= p.pos.x || e.pos.x >= p.pos.x + p.w) continue;
      // Feet must have been at or above the platform's top, before or after it moved this step.
      // (A rider on a descending platform was carried down to its new top, below the old one.)
      if (prevBottom > Math.max(p.pos.y, p.pos.y - p.dy) + 0.01 || bottom < p.pos.y) continue;
      e.pos.y = p.pos.y - e.h;
      e.vel.y = 0;
      this._hit.ground = true;
      this._hit.platform = p;
      return;
    }
  }

  /** Is a wall-jumpable tile (`#` or `B`) directly beside the entity? `dir` is -1 or 1. */
  wallAt(e, dir) {
    const c = Math.floor((dir > 0 ? e.pos.x + e.w + 0.5 : e.pos.x - 0.5) / T);
    const r0 = Math.floor((e.pos.y + 2) / T);
    const r1 = Math.floor((e.pos.y + e.h - 2) / T);
    for (let r = r0; r <= r1; r++) if (isWallTile(this.at(c, r))) return true;
    return false;
  }

  /** Is there something to stand on just ahead of the entity's front foot? (Walkers turn at ledges.) */
  groundAhead(e, dir) {
    const c = Math.floor((dir > 0 ? e.pos.x + e.w + 1 : e.pos.x - 1) / T);
    const r = Math.floor((e.pos.y + e.h + 1) / T);
    return this.isSolid(c, r) || this.at(c, r) === '-';
  }

  /** Standing only on one-way tiles, so ↓ + Jump may drop through. */
  onOneWayOnly(e) {
    const r = Math.floor((e.pos.y + e.h + 1) / T);
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    let oneWay = false;
    for (let c = c0; c <= c1; c++) {
      if (this.isSolid(c, r)) return false;
      if (this.at(c, r) === '-') oneWay = true;
    }
    return oneWay;
  }

  /** Both feet are over tiles (not a platform or an edge): a safe place to return to after a pit. */
  fullySupported(e) {
    const r = Math.floor((e.pos.y + e.h + 1) / T);
    // Only permanent footing counts: not switch blocks, crumble blocks or platforms.
    const footing = (c) => {
      const t = this.at(c, r);
      return isWallTile(t) || t === '-' || t === '<' || t === '>';
    };
    return footing(Math.floor(e.pos.x / T)) && footing(Math.floor((e.pos.x + e.w - 0.001) / T)) && !this.touchesSpikes(e);
  }

  /** Only the lower half of a spike tile hurts. */
  touchesSpikes(e) {
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    const r0 = Math.floor(e.pos.y / T);
    const r1 = Math.floor((e.pos.y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.at(c, r) === '^' && e.pos.y + e.h > r * T + T / 2) return true;
      }
    }
    return false;
  }

  /** Flood-fill connected `%` tiles so a whole fake wall fades together. Returns a region id per tile (-1 = none). */
  _labelFakeRegions() {
    const ids = this.grid.map((row) => row.map(() => -1));
    let next = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== '%' || ids[r][c] >= 0) continue;
        const stack = [[c, r]];
        ids[r][c] = next;
        this.cracked.add(r * this.cols + c);
        while (stack.length > 0) {
          const [x, y] = stack.pop();
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (this.at(nx, ny) === '%' && ny >= 0 && ny < this.rows && nx >= 0 && nx < this.cols && ids[ny][nx] < 0) {
              ids[ny][nx] = next;
              stack.push([nx, ny]);
            }
          }
        }
        next++;
      }
    }
    this.fakeRegionCount = next;
    this._addPockets(ids);
    return ids;
  }

  /**
   * A secret pocket is a small enclosed patch of empty cells whose only way in is through a fake wall
   * (e.g. the gem cell behind level 1's `%%%`). Pockets join their wall's region, so FakeWalls draws
   * them as solid ground and fades them with the wall; otherwise the hole would give the secret away.
   */
  _addPockets(ids) {
    this.pockets = new Set();
    const seen = new Set();
    const key = (c, r) => r * this.cols + c;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (ids[r][c] < 0) continue;
        for (const [sc, sr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
          if (sr < 0 || sr >= this.rows || this.at(sc, sr) !== '.' || seen.has(key(sc, sr))) continue;
          // Flood the empty area; it's a pocket if it stays small and enclosed by blocks and fake walls.
          const cells = [];
          const stack = [[sc, sr]];
          seen.add(key(sc, sr));
          let enclosed = true;
          while (stack.length > 0 && enclosed) {
            const [x, y] = stack.pop();
            cells.push([x, y]);
            if (cells.length > POCKET_MAX || x <= 0 || y <= 0 || x >= this.cols - 1 || y >= this.rows - 1) enclosed = false;
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
              if (this.at(nx, ny) !== '.' || seen.has(key(nx, ny))) continue;
              seen.add(key(nx, ny));
              stack.push([nx, ny]);
            }
          }
          if (!enclosed) continue;
          for (const [x, y] of cells) {
            ids[y][x] = ids[r][c];
            this.pockets.add(key(x, y));
          }
        }
      }
    }
  }

  /** Draw only the tiles inside the camera view. Fake walls are drawn by `FakeWalls`, above the player. */
  /**
   * Static tiles and decorations are drawn from pre-rendered strips; switch blocks, which change,
   * are drawn tile by tile on top. Fake walls are drawn by `FakeWalls`, above the player.
   */
  render(r) {
    const view = this.scene.camera.view;
    const s0 = Math.max(0, Math.floor(view.x / STRIP_PX));
    const s1 = Math.min(Math.ceil(this.cols / STRIP_COLS) - 1, Math.floor((view.x + view.w) / STRIP_PX));
    for (let s = s0; s <= s1; s++) r.image(this._strip(s), s * STRIP_PX, 0);
    const c0 = Math.max(0, Math.floor(view.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((view.x + view.w) / T));
    const r0 = Math.max(0, Math.floor(view.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((view.y + view.h) / T));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = this.grid[row][col];
        if (t === 'R' || t === 'U') this.drawTile(r, t, col, row);
      }
    }
  }

  /**
   * One strip of STRIP_COLS columns, painted 1:1 on first use. Drawing tiles one by one at a
   * fractional screen scale (phones) leaves faint lines where their softened edges meet; a strip
   * has no inner edges. Each strip also paints the next strip's first column, which that strip
   * then covers exactly, so the edge between strips can't show through either.
   */
  _strip(s) {
    this.strips ??= new Map();
    let strip = this.strips.get(s);
    if (strip) return strip;
    strip = document.createElement('canvas');
    strip.width = STRIP_PX + T;
    strip.height = this.rows * T;
    const ctx = strip.getContext('2d');
    const sheet = tiles(this.world);
    const props = decor(this.world).sheet;
    const draw = (f, x, y) => ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, x, y, f.sw, f.sh);
    for (let col = s * STRIP_COLS; col <= Math.min(this.cols - 1, (s + 1) * STRIP_COLS); col++) {
      const x = col * T - s * STRIP_PX;
      for (let row = 0; row < this.rows; row++) {
        const t = this.grid[row][col];
        if (t === '.') {
          const d = this.decor[row][col];
          if (d >= 0) draw(props.frame(d), x, row * T);
        } else if (t !== '%' && t !== 'R' && t !== 'U') {
          const frame = this.frames[row][col];
          if (frame >= 0) draw(sheet.frame(frame), x, row * T);
          else {
            ctx.fillStyle = '#ff00ff'; // tile not implemented yet
            ctx.fillRect(x, row * T, T, T);
          }
        }
      }
    }
    this.strips.set(s, strip);
    return strip;
  }

  /** Sprite frame for each tile, chosen once at load (grass on exposed tops, variants by position). */
  _tileFrames() {
    // A side is exposed unless a block sits there. Off the map counts as covered, so the level's
    // outer border has no edges; switch blocks count as open because they come and go.
    const covered = (c, r) => {
      if (r < 0 || r >= this.rows) return true;
      const t = this.at(c, r);
      return t === '#' || t === 'B' || t === '%' || t === '<' || t === '>' || this.pockets.has(r * this.cols + c);
    };
    const mask = (c, r) =>
      (covered(c, r - 1) ? 0 : OPEN.top) |
      (covered(c + 1, r) ? 0 : OPEN.right) |
      (covered(c, r + 1) ? 0 : OPEN.bottom) |
      (covered(c - 1, r) ? 0 : OPEN.left);
    return this.grid.map((line, r) =>
      line.map((t, c) => {
        // Fake walls use the same frames as the ground around them, so they really look like `#`.
        if (t === '#' || t === '%' || this.pockets.has(r * this.cols + c)) return groundFrame(mask(c, r), hash2(c, r) > 0.6 ? 1 : 0);
        if (t === 'B') return brickFrame(mask(c, r));
        if (t === '-') return TILE.oneWay;
        if (t === '^') return TILE.spikes;
        if (t === '<') return TILE.cannonL;
        if (t === '>') return TILE.cannonR;
        if (t === 'R' || t === 'U') return TILE.redOn; // chosen per frame in drawTile
        return -1;
      }),
    );
  }

  /**
   * Decoration frame per empty cell (-1 = none): a standing piece on exposed ground below it, or a
   * hanging piece under a ledge above it. Chosen by position hash, so it never changes between visits.
   */
  _decorFrames() {
    const { top, hang } = decorCounts(this.world);
    const ground = (c, r) => this.at(c, r) === '#' && r < this.rows;
    return this.grid.map((line, r) =>
      line.map((t, c) => {
        if (t !== '.' || this.pockets.has(r * this.cols + c)) return -1;
        const roll = hash2(c * 7 + 3, r * 13 + 5);
        if (r + 1 < this.rows && ground(c, r + 1) && roll < 0.45) return Math.floor(hash2(c, r + 99) * top);
        if (r > 0 && ground(c, r - 1) && roll < 0.3) return top + Math.floor(hash2(c + 99, r) * hang);
        return -1;
      }),
    );
  }

  drawTile(r, t, col, row) {
    let frame = this.frames[row][col];
    if (t === 'R') frame = this.redOn ? TILE.redOn : TILE.redOff;
    else if (t === 'U') frame = this.redOn ? TILE.blueOff : TILE.blueOn;
    if (frame >= 0) r.sprite(tiles(this.world).frame(frame), col * T, row * T);
    else r.rect(col * T, row * T, T, T, '#ff00ff'); // tile not implemented yet
  }
}

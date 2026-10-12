import { Collision, Entity, Rect } from '../../vendor/h3-engine.min.js';
import { T, WORLDS } from '../config.js';

// Characters that become entities; their tile is left empty (§4.1).
const SPAWN_CHARS = 'PFCoGHSe';
// Tile characters the level draws and collides with itself.
const TILE_CHARS = '.#B-^%';

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
    this.palette = WORLDS[def.world ?? 1];
    this.spawns = []; // { ch, x, y } in pixels
    this.unknown = new Set();
    this.platforms = []; // moving platforms Hop can land on
    this.grid = map.map((line, r) =>
      [...line.padEnd(cols, '.')].map((ch, c) => {
        if (SPAWN_CHARS.includes(ch)) {
          this.spawns.push({ ch, x: c * T, y: r * T });
          return '.';
        }
        if (!TILE_CHARS.includes(ch)) this.unknown.add(ch);
        return ch;
      }),
    );
    this.fakeRegions = this._labelFakeRegions();
    this._tile = new Rect();
    this._hit = { wall: '', ground: false, ceiling: false, platform: null };
  }

  /** The left and right edges act as walls; above and below are open. */
  at(c, r) {
    if (c < 0 || c >= this.cols) return '#';
    if (r < 0 || r >= this.rows) return '.';
    return this.grid[r][c];
  }

  isSolid(c, r) {
    const t = this.at(c, r);
    return t === '#' || t === 'B';
  }

  /**
   * Move X then Y, pushing out of tiles and landing on moving platforms.
   * Honours `e.dropTimer > 0` by ignoring one-way surfaces.
   * @returns {{ wall: string, ground: boolean, ceiling: boolean, platform: Entity | null }} Shared object.
   */
  moveAndCollide(e, dt) {
    const hit = this._hit;
    hit.wall = '';
    hit.ground = hit.ceiling = false;
    hit.platform = null;
    e.pos.x += e.vel.x * dt;
    this._collide(e, 'x', 0);
    const prevBottom = e.pos.y + e.h;
    e.pos.y += e.vel.y * dt;
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
        let solid = t === '#' || t === 'B';
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
  }

  /** Moving platforms are solid on top only, like one-way tiles. */
  _landOnPlatforms(e, prevBottom) {
    const bottom = e.pos.y + e.h;
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (e.pos.x + e.w <= p.pos.x || e.pos.x >= p.pos.x + p.w) continue;
      // Compare with the platform's top before it moved this step.
      if (prevBottom > p.pos.y - p.dy + 0.01 || bottom < p.pos.y) continue;
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
    for (let r = r0; r <= r1; r++) if (this.isSolid(c, r)) return true;
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
    const footing = (c) => this.isSolid(c, r) || this.at(c, r) === '-';
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
    return ids;
  }

  /** Draw only the tiles inside the camera view. Fake walls are drawn by `FakeWalls`, above the player. */
  render(r) {
    const view = this.scene.camera.view;
    const c0 = Math.max(0, Math.floor(view.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((view.x + view.w) / T));
    const r0 = Math.max(0, Math.floor(view.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((view.y + view.h) / T));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = this.grid[row][col];
        if (t !== '.' && t !== '%') this.drawTile(r, t, col, row);
      }
    }
  }

  drawTile(r, t, col, row) {
    // Placeholder art; replace with sprite-sheet frames per world.
    const x = col * T;
    const y = row * T;
    const pal = this.palette;
    if (t === '#') drawGround(r, x, y, pal, !this.isSolid(col, row - 1) && this.at(col, row - 1) !== '%');
    else if (t === 'B') drawBrick(r, x, y);
    else if (t === '-') {
      r.rect(x, y, T, 4, '#c08a4b');
      r.rect(x, y + 4, T, 1, '#7a5530');
    } else if (t === '^') drawSpikes(r, x, y);
    else r.rect(x, y, T, T, '#ff00ff'); // not implemented yet
  }
}

export const drawGround = (r, x, y, pal, grassy) => {
  r.rect(x, y, T, T, pal.ground);
  r.rect(x + 3, y + 9, 2, 2, 'rgba(0,0,0,0.15)');
  r.rect(x + 11, y + 4, 2, 2, 'rgba(0,0,0,0.15)');
  if (grassy) {
    r.rect(x, y, T, 4, pal.top);
    r.rect(x, y + 4, T, 1, 'rgba(0,0,0,0.2)');
  }
};

const drawBrick = (r, x, y) => {
  r.rect(x, y, T, T, '#d9822b');
  r.rect(x, y + 7, T, 1, '#8c4f17');
  r.rect(x, y + 15, T, 1, '#8c4f17');
  r.rect(x + 7, y, 1, 7, '#8c4f17');
  r.rect(x + 3, y + 8, 1, 7, '#8c4f17');
  r.rect(x + 11, y + 8, 1, 7, '#8c4f17');
};

// Hazards: light-grey base with red tips (§7).
const drawSpikes = (r, x, y) => {
  r.poly([x, y + T, x + 4, y + 7, x + 8, y + T], '#dcdce6');
  r.poly([x + 8, y + T, x + 12, y + 7, x + 16, y + T], '#dcdce6');
  r.rect(x + 3, y + 7, 2, 3, '#ff3b3b');
  r.rect(x + 11, y + 7, 2, 3, '#ff3b3b');
};

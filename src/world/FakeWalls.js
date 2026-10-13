import { Entity } from '../../vendor/h3-engine.min.js';
import { T } from '../config.js';
import { tiles, TILE } from '../art/tiles.js';

const INSIDE_ALPHA = 0.4;

/** Draws `%` tiles above the player so they hide secrets, fading a whole wall when Hop is inside it (§4.1). */
export class FakeWalls extends Entity {
  constructor(level) {
    super({ z: 8, tags: ['fake-walls'] });
    this.debug = false;
    this.level = level;
    this.inside = new Uint8Array(Math.max(1, level.fakeRegionCount));
  }

  update() {
    const level = this.level;
    const player = this.scene.player;
    this.inside.fill(0);
    if (!player || level.fakeRegionCount === 0) return;
    const c0 = Math.floor(player.pos.x / T);
    const c1 = Math.floor((player.pos.x + player.w - 0.001) / T);
    const r0 = Math.floor(player.pos.y / T);
    const r1 = Math.floor((player.pos.y + player.h - 0.001) / T);
    for (let r = Math.max(0, r0); r <= Math.min(level.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(level.cols - 1, c1); c++) {
        const id = level.fakeRegions[r][c];
        if (id >= 0) this.inside[id] = 1;
      }
    }
  }

  render(r) {
    const level = this.level;
    if (level.fakeRegionCount === 0) return;
    const view = this.scene.camera.view;
    const c0 = Math.max(0, Math.floor(view.x / T));
    const c1 = Math.min(level.cols - 1, Math.floor((view.x + view.w) / T));
    const r0 = Math.max(0, Math.floor(view.y / T));
    const r1 = Math.min(level.rows - 1, Math.floor((view.y + view.h) / T));
    const sheet = tiles(level.world);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const id = level.fakeRegions[row][col];
        if (id < 0) continue;
        r.alpha = this.inside[id] ? INSIDE_ALPHA : 1;
        r.sprite(sheet.frame(level.frames[row][col]), col * T, row * T);
        if (level.cracked.has(row * level.cols + col)) r.sprite(sheet.frame(TILE.crack), col * T, row * T);
      }
    }
    r.alpha = 1;
  }
}

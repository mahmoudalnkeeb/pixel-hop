import { Entity } from '../../vendor/h3-engine.min.js';
import { CULL_MARGIN, GRAVITY, MAX_FALL, SLIME_SPEED, T } from '../config.js';

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
    const wob = Math.round(Math.sin(this.t * 10));
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y) + wob;
    const h = this.h - wob;
    r.rect(x + 2, y, this.w - 4, 2, '#4fbf3f');
    r.rect(x, y + 2, this.w, h - 2, '#4fbf3f');
    r.rect(x, y + h - 2, this.w, 2, '#2f8a2a');
    const ex = this.dir < 0 ? x + 2 : x + 6;
    r.rect(ex, y + 3, 2, 3, '#fff');
    r.rect(ex + 3, y + 3, 2, 3, '#fff');
    r.rect(ex + (this.dir < 0 ? 0 : 1), y + 4, 1, 2, '#123');
    r.rect(ex + 3 + (this.dir < 0 ? 0 : 1), y + 4, 1, 2, '#123');
  }
}

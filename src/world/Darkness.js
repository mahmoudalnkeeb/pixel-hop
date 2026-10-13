import { CRYSTAL_RADIUS, LIGHT_RADIUS, MAX_VIEW_H, MAX_VIEW_W, VIEW_H, VIEW_W } from '../config.js';

/** Soft-edged hole sprite: opaque centre fading to transparent, used to erase light pools from the dark. */
const hole = (radius) => {
  const c = document.createElement('canvas');
  c.width = c.height = radius * 2;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(radius, radius, radius * 0.45, radius, radius, radius);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, radius * 2, radius * 2);
  return c;
};

/**
 * Cave darkness (§4.2): a dark overlay with light pools around Hop and crystals, built on an offscreen
 * canvas and drawn with one `r.image` per frame (§9.3). Canvas 2D only; this file is the single place a
 * future WebGL backend has to replace.
 */
export class Darkness {
  /** @param {number} alpha 0.3 for level 5's subtle debut, 0.6 for full caves. */
  constructor(alpha) {
    this.alpha = alpha;
    this.canvas = document.createElement('canvas');
    // Sized for the largest view; only the current view's area is filled.
    this.canvas.width = MAX_VIEW_W;
    this.canvas.height = MAX_VIEW_H;
    this.ctx = this.canvas.getContext('2d');
    this.player = hole(LIGHT_RADIUS);
    this.crystal = hole(CRYSTAL_RADIUS);
    this._pt = { x: 0, y: 0 };
    this._lights = [];
  }

  render(r, scene) {
    const ctx = this.ctx;
    const cam = scene.camera;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, MAX_VIEW_W, MAX_VIEW_H);
    ctx.fillStyle = `rgba(5,5,15,${this.alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = 'destination-out';
    const p = scene.player;
    const pt = cam.worldToScreen(p.cx, p.cy, this._pt);
    ctx.drawImage(this.player, pt.x - LIGHT_RADIUS, pt.y - LIGHT_RADIUS);
    const view = cam.view;
    for (const light of scene.find('light', this._lights)) {
      if (light.pos.x + CRYSTAL_RADIUS < view.x || light.pos.x - CRYSTAL_RADIUS > view.x + view.w) continue;
      cam.worldToScreen(light.cx, light.cy, pt);
      ctx.drawImage(this.crystal, pt.x - CRYSTAL_RADIUS, pt.y - CRYSTAL_RADIUS);
    }
    r.image(this.canvas, 0, 0);
  }
}

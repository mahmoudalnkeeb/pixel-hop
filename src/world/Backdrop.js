import { Entity } from '../../vendor/h3-engine.min.js';

// Cheap deterministic noise so scenery doesn't change between frames (Appendix C.4).
const hash = (i) => {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/** Repeat a feature every `spacing` px on a layer scrolling at `factor` × the camera speed. */
function layer(view, factor, spacing, draw) {
  const offset = view.x * factor;
  const first = Math.floor(offset / spacing) - 2;
  const last = Math.ceil((offset + view.w) / spacing) + 2;
  for (let i = first; i <= last; i++) draw(view.x + i * spacing - offset, i);
}

/** Three parallax layers at 0.1, 0.3 and 0.5 of the camera speed (§7). Placeholder shapes until world art exists. */
export class Backdrop extends Entity {
  constructor(palette) {
    super({ z: -10, tags: ['backdrop'] });
    this.debug = false;
    this.palette = palette;
  }

  render(r) {
    const view = this.scene.camera.view;
    const pal = this.palette;
    const base = view.y + view.h;
    layer(view, 0.1, 90, (wx, i) => {
      r.circle(Math.round(wx), Math.round(view.y + 30 + hash(i) * 30), 10 + hash(i + 7) * 8, 'rgba(255,255,255,0.35)'); // clouds
    });
    layer(view, 0.3, 70, (wx, i) => {
      r.circle(Math.round(wx), Math.round(base + 10), 40 + hash(i) * 30, pal.far); // far hills
    });
    layer(view, 0.5, 50, (wx, i) => {
      r.circle(Math.round(wx), Math.round(base + 20), 26 + hash(i + 3) * 18, pal.near); // near hills
    });
  }
}

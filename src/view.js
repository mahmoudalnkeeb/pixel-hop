import { MAX_VIEW_H, MAX_VIEW_W, MIN_VIEW_H, MIN_VIEW_W, setViewSize, VIEW_H, VIEW_W } from './config.js';

/**
 * Size the logical view to the window's shape so the screen is filled instead of letterboxed.
 * Start from the largest whole-device-pixel scale at which 320×180 fits (crisp pixels). If the view
 * would then outgrow MAX_VIEW_*, scale up by a fraction instead, which is invisible at phone pixel
 * densities. Only windows squarer than 16:10 (tablets, 4:3 monitors) keep bars.
 */
const fit = () => {
  const dpr = window.devicePixelRatio || 1;
  const crisp = Math.max(1, Math.floor(Math.min(innerWidth / MIN_VIEW_W, innerHeight / MIN_VIEW_H) * dpr)) / dpr;
  const atLeast = Math.max(crisp, innerWidth / MAX_VIEW_W, innerHeight / MAX_VIEW_H);
  const atMost = Math.min(innerWidth / MIN_VIEW_W, innerHeight / MIN_VIEW_H);
  const scale = Math.min(atLeast, atMost);
  const w = Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, Math.floor(innerWidth / scale)));
  const h = Math.max(MIN_VIEW_H, Math.min(MAX_VIEW_H, Math.floor(innerHeight / scale)));
  return { w, h };
};

/** Size for the first frame, before the Game exists. */
export const initialViewSize = () => {
  const { w, h } = fit();
  setViewSize(w, h);
  return { w, h };
};

/**
 * Keep the view fitted as the window resizes or rotates.
 * h3-engine fixes the logical size at construction (no resize API yet), so this updates the size
 * fields the engine reads (game, renderer, viewport, every scene camera) and asks it to resize.
 */
export const followWindow = (game) => {
  const apply = () => {
    const { w, h } = fit();
    if (w === VIEW_W && h === VIEW_H) return;
    setViewSize(w, h);
    game.width = game.renderer.width = game.renderer.viewport.width = w;
    game.height = game.renderer.height = game.renderer.viewport.height = h;
    for (const scene of game.scenes.stack) {
      scene.camera.viewW = w;
      scene.camera.viewH = h;
    }
    game.renderer.resize();
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  game.events.on('resize', () => stretch(game));
  stretch(game);
};

/**
 * Flooring the view size leaves up to one logical pixel uncovered at the window edges. When the view
 * covers the window (it wasn't capped by MAX_VIEW_*), stretch that last fraction to remove the hairline.
 */
const stretch = (game) => {
  const scale = game.renderer.pixelScale;
  const style = game.renderer.canvas.style;
  if (innerWidth - VIEW_W * scale < scale && innerHeight - VIEW_H * scale < scale) {
    style.width = `${innerWidth}px`;
    style.height = `${innerHeight}px`;
  }
};

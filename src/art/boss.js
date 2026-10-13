import { SpriteSheet } from '../../vendor/h3-engine.min.js';
import { canvas, ellipse, px } from './paint.js';

// King Gloop, drawn 56×48 around a 48×40 hitbox (§6.1).
const W = 56;
const H = 48;

export const BOSS_FRAMES = { idle: 0, tell: 1, dazed: 2, roar: 3, flash: 4 };

const C = {
  outline: '#1f3a16',
  body: '#8fd14f',
  shade: '#5fa83a',
  light: '#d2f59c',
  white: '#ffffff',
  pupil: '#1d1d2b',
  mouth: '#3a1020',
  tongue: '#ff5e7a',
  gold: '#ffd23f',
  goldDark: '#c99a12',
  goldLight: '#fff3b0',
  deep: '#3f7a26',
  belly: '#a8e070',
  ruby: '#ff3b3b',
};

const body = (ctx, ox) => {
  ellipse(ctx, ox + 28, 28, 27, 21, C.outline, 47);
  ellipse(ctx, ox + 28, 28, 26, 20, C.deep, 46);
  ellipse(ctx, ox + 28, 27, 25, 19, C.shade, 46);
  ellipse(ctx, ox + 28, 25, 24, 17, C.body, 46);
  // Belly: a paler oval, then gloss on the upper left.
  ellipse(ctx, ox + 30, 33, 14, 8, C.belly, 44);
  ellipse(ctx, ox + 16, 17, 6, 3, C.light);
  px(ctx, ox + 12, 16, 3, 1, C.white);
  ellipse(ctx, ox + 44, 22, 2, 1, C.light);
  // Slime drips along the base.
  for (const [x, h] of [[9, 3], [17, 2], [41, 3], [47, 2]]) {
    px(ctx, ox + x, 44, 3, h, C.shade);
    px(ctx, ox + x, 44 + h, 3, 1, C.outline);
  }
  px(ctx, ox + 3, 46, 50, 1, C.outline);
};

const crown = (ctx, ox) => {
  // Outline first, then the gold, so the crown reads against the green.
  px(ctx, ox + 16, 5, 24, 7, C.goldDark);
  for (const x of [16, 25, 34]) {
    px(ctx, ox + x, 2, 6, 4, C.goldDark);
    px(ctx, ox + x + 1, 0, 4, 3, C.goldDark);
  }
  px(ctx, ox + 17, 6, 22, 5, C.gold);
  px(ctx, ox + 17, 10, 22, 1, C.goldDark);
  px(ctx, ox + 17, 6, 22, 1, C.goldLight);
  for (const x of [17, 26, 35]) {
    px(ctx, ox + x, 3, 4, 3, C.gold);
    px(ctx, ox + x + 1, 1, 2, 2, C.gold);
    px(ctx, ox + x + 1, 1, 1, 1, C.goldLight);
  }
  for (const x of [20, 28, 36]) {
    px(ctx, ox + x, 7, 2, 2, C.ruby);
    px(ctx, ox + x, 7, 1, 1, '#ffb3b3');
  }
};

const eyes = (ctx, ox, kind) => {
  for (const cx of [20, 36]) {
    if (kind === 'tell') {
      px(ctx, ox + cx - 4, 22, 9, 2, C.outline); // squeezed shut
      continue;
    }
    ellipse(ctx, ox + cx, 22, 5, 6, C.white);
    if (kind === 'dazed') {
      // Spinning eyes: a ring with a dot.
      px(ctx, ox + cx - 3, 19, 6, 1, C.pupil);
      px(ctx, ox + cx - 3, 25, 6, 1, C.pupil);
      px(ctx, ox + cx - 3, 19, 1, 7, C.pupil);
      px(ctx, ox + cx + 2, 19, 1, 7, C.pupil);
      px(ctx, ox + cx - 1, 22, 2, 1, C.pupil);
    } else {
      px(ctx, ox + cx - 1, 20, 3, 5, C.pupil);
      px(ctx, ox + cx, 20, 1, 1, C.white);
    }
  }
  // Pompous brows.
  px(ctx, ox + 14, 14, 9, 2, C.outline);
  px(ctx, ox + 33, 14, 9, 2, C.outline);
};

const mouth = (ctx, ox, kind) => {
  if (kind === 'roar') {
    ellipse(ctx, ox + 28, 36, 9, 6, C.mouth);
    ellipse(ctx, ox + 28, 39, 5, 2, C.tongue);
    return;
  }
  if (kind === 'dazed') {
    px(ctx, ox + 22, 35, 12, 2, C.mouth);
    px(ctx, ox + 30, 37, 3, 3, C.tongue);
    return;
  }
  px(ctx, ox + 21, 35, 14, 2, C.mouth);
  px(ctx, ox + 19, 33, 2, 2, C.mouth);
  px(ctx, ox + 35, 33, 2, 2, C.mouth);
};

const face = (kind) => (ctx, ox) => {
  body(ctx, ox);
  crown(ctx, ox);
  eyes(ctx, ox, kind);
  mouth(ctx, ox, kind);
};

let sheet = null;

export const bossSheet = () => {
  if (sheet) return sheet;
  const painters = [face('idle'), face('tell'), face('dazed'), face('roar')];
  const image = canvas(W * (painters.length + 1), H, (ctx) => {
    painters.forEach((paint, i) => paint(ctx, i * W));
    // Hit flash: the idle silhouette in white.
    const flash = W * painters.length;
    face('idle')(ctx, flash);
    ctx.globalCompositeOperation = 'source-atop';
    px(ctx, flash, 0, W, H, '#ffffff');
    ctx.globalCompositeOperation = 'source-over';
  });
  sheet = new SpriteSheet(image, { frameW: W, frameH: H, originX: 0.5, originY: 1 });
  return sheet;
};

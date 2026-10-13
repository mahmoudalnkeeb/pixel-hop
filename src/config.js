// Every tunable number lives here (GDD §3.2). Tune the game only through this file.

export const T = 16; // tile size, px
export const VIEW_W = 320;
export const VIEW_H = 180;

// Movement (§3.2)
export const GRAVITY = 900; // rising, and for everything that isn't Hop
export const FALL_GRAVITY = 1250; // Hop falls faster than he rises, so jumps feel weighty, not floaty
export const APEX_SPEED = 40; // px/s; below this vertical speed with jump held...
export const APEX_GRAVITY = 0.5; // ...gravity is scaled by this: a short hang at the top of the arc
export const MAX_FALL = 420;
export const RUN_SPEED = 110;
export const ACCEL_GROUND = 2000; // full speed in about 0.05 s
export const ACCEL_AIR = 1200;
export const FRICTION = 2600; // stops in about 0.04 s
export const JUMP_SPEED = 320;
export const JUMP_CUT_SPEED = 80; // releasing jump caps upward speed to this (a hard cut)...
export const JUMP_MIN_TIME = 0.07; // ...but only after rising this long, so a tap is still a short hop
export const NUDGE = 4; // px; head bumps on a corner slide past it, and feet clipping a ledge pop up onto it
export const COYOTE_TIME = 0.08;
export const JUMP_BUFFER = 0.12;
export const STOMP_BOUNCE = 220;
export const STOMP_BOUNCE_HELD = 300;
export const SPRING_SPEED = 480;
export const WALL_SLIDE_MAX = 60;
export const WALL_JUMP_VX = 140;
export const WALL_JUMP_VY = 300;
export const WALL_JUMP_LOCK = 0.12; // the kick away from the wall can't be steered this long
export const WALL_COYOTE = 0.08;
export const WALL_JUMP_FROM_LEVEL = 5;
export const DROP_THROUGH_TIME = 0.2; // one-way platforms ignored this long after ↓ + Jump
export const PLAYER_W = 12;
export const PLAYER_H = 14;

// Health (§3.4)
export const MAX_HEARTS = 3;
export const KNOCKBACK_VX = 120;
export const KNOCKBACK_VY = 180;
export const INVULN_TIME = 1.0;
export const FLICKER_HZ = 15;
export const DEATH_TIME = 0.5;
export const LAND_SQUASH_SPEED = 150;

// Enemies (§4.3)
export const STOMP_REACH = 8; // px; feet must be less than this below the enemy's top
export const HURT_INSET = 2; // px; Hop's hurtbox is this much smaller than his body on the sides and top
export const SLIME_SPEED = 30;
export const HOPPER_VX = 60;
export const HOPPER_VY = 260;
export const KNIGHT_SPEED = 35;
export const KNIGHT_SPEED_BARE = 60;
export const THORNBACK_SPEED = 40;
export const BAT_SPEED = 40;
export const BAT_AMPLITUDE = 16;
export const BAT_PERIOD = 2;
export const BAT_WAKE_RANGE = 6 * T;
export const DROPPER_TELL = 0.35;
export const DROPPER_GRAVITY = 2 * 900;
export const SCORE_DROPPER_DODGED = 50;
export const PUFFER_EVERY = 2.5;
export const PUFFER_TELL = 0.4;
export const PUFFER_RANGE = 10 * T;
export const SPORE_SPEED = 80;
export const ACORN_SPEED = 90;
export const ACORN_INTERVAL = 2.0;
export const CULL_MARGIN = 2 * T;

// Mechanics (§4.2)
export const CRUMBLE_SHAKE = 0.5;
export const CRUMBLE_RESPAWN = 3;
export const CRUMBLE_FADE = 0.2;
export const SWITCH_COOLDOWN = 0.25;
export const SWITCH_STOMP_SPEED = 100; // landing faster than this on a switch flips it
export const WIND_DRIFT = 0.2; // horizontal wind moves Hop at force × this px/s
export const UPDRAFT_MAX = 140; // fastest an updraft lifts Hop, px/s
export const LIGHT_RADIUS = 72; // darkness cut-out around Hop (§4.2)
export const CRYSTAL_RADIUS = 40;
export const THORNWATER_CAMERA_BIAS = -40;

// Boss: King Gloop (§6)
export const BOSS_HP = 6;
export const BOSS_PHASE_HP = [6, 4, 2, 0]; // HP at the start of phase 1, 2, 3, and at defeat
export const BOSS_TELL = 0.4;
export const BOSS_AIR_TIME = 0.9;
export const BOSS_HOP_PEAK = 4; // tiles
export const BOSS_DAZED = [2.0, 1.6, 1.4]; // per phase
export const BOSS_HIT_BOUNCE = 360;
export const BOSS_HIT_INVULN = 1.0;
export const BOSS_ARENA_SILENCE = 1.5;
export const BOSS_BELCH_TELL = 0.5;
export const BOSS_GOO_EVERY = 1.8;
export const BOSS_COURT_TIMEOUT = 10;
export const BOSS_CHARGE_TELL = 0.6;
export const BOSS_CHARGE_SPEED = 220;
export const BOSS_PHASE3_SPEED = 1.25; // "everything runs ×1.25 faster"
export const BOSS_SLOWMO = 0.8; // real seconds at ×0.3 on the final hit
export const BOSS_ASSIST_OFFER_DEATHS = 5;
export const SHOCKWAVE_SPEED = 120;

// Scoring (§4.4)
export const SCORE_COIN = 10;
export const SCORE_GEM = 500;
export const SCORE_HEART_FULL = 50;
export const SCORE_CLEAR = 1000;
export const SCORE_TIME_BONUS = 20; // per second under par
export const CHAIN_SCORES = [100, 200, 400, 800, 1000];

// Camera (§5.1)
export const CAMERA_LERP = 0.15;
export const CAMERA_OFFSET_Y = -16;
export const CAMERA_LOOK_AHEAD = 24;
export const CAMERA_LOOK_LERP = 0.05;

// Juice (§7)
export const SHAKE_STOMP = 2;
export const SHAKE_HURT = 3;
export const SHAKE_BOSS_SLAM = 4;
export const SHAKE_SCALE = { on: 1, reduced: 0.5, off: 0 }; // options (§9.5)

// All levels in play order (§5.3). `sandbox` is a test level reached with ?level=sandbox.
export const LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
// Levels whose files exist in this build; the rest show as "coming soon" on the map.
export const BUILT_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
export const EXTRA_LEVELS = ['sandbox'];
export const LEVEL_NAMES = [
  'Green Hills', 'Spike Valley', 'Bramble Woods', 'Sunken Ruins', 'Crystal Caves',
  'Echo Mines', 'Cloud Ruins', 'Sky Bridge', 'Storm Keep', 'Throne of Gloop',
];

// World palettes (§5.2): sky, ground, grass, accent.
export const WORLDS = {
  1: { sky: '#6ec6ff', ground: '#8a5a2b', top: '#5cc94e', accent: '#ff5e5b', far: '#a9dcf5', near: '#8fd3a8' },
  2: { sky: '#2e4a3a', ground: '#5b4632', top: '#3f7d3a', accent: '#e0b84a', far: '#3a5a48', near: '#41634d' },
  3: { sky: '#141625', ground: '#3b3a52', top: '#6a6890', accent: '#6fe3ff', far: '#1c1e32', near: '#25283f' },
  4: { sky: '#ffd9a8', ground: '#e8e0f0', top: '#b7a6d6', accent: '#ff8fb1', far: '#ffe7c7', near: '#f5d6e6' },
  5: { sky: '#2a1f3d', ground: '#4b3b5c', top: '#6d5a7e', accent: '#9be36b', far: '#33284a', near: '#3d3155' },
};

// Controls (§3.1). Remapping replaces these arrays.
export const LEFT = ['ArrowLeft', 'KeyA'];
export const RIGHT = ['ArrowRight', 'KeyD'];
export const DOWN = ['ArrowDown', 'KeyS'];
export const JUMP = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
export const PAUSE = ['Escape', 'KeyP'];
export const CONFIRM = ['Enter', 'Space'];
export const BACK = ['Escape', 'Backspace'];
export const MENU_UP = ['ArrowUp', 'KeyW'];
export const MENU_DOWN = ['ArrowDown', 'KeyS'];

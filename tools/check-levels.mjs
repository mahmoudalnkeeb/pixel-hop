// Level checker: proves the flag and every gem are reachable using the real Player physics (GDD §11 M2, §12).
// Usage: node tools/check-levels.mjs [levelId ...]   (default: every built level)
//
// Breadth-first search over "standing" states. From each one it simulates macro inputs (run-up, jump hold time,
// air steering, wall-jump climbing, drop-through) with the actual Player controller and records where Hop lands.
// Approximations, all in the player's favour so a failure is a real problem:
//   - enemies and thornwater are ignored; crumble blocks are permanent solids;
//   - moving platforms become one-way tiles over the area they sweep;
//   - acorn lanes act as a stompable surface wherever an acorn could be;
//   - switch blocks are modelled exactly (red/blue state is part of the search state).
// Gems that need an enemy (e.g. stomping a Hopper mid-hop) are listed in the level's `checker.enemyGems` and skipped.
import { readFileSync } from 'node:fs';
import { Rect, Scene } from '../vendor/h3-engine.min.js';
import { BUILT_LEVELS, DOWN, JUMP, LEFT, RIGHT, SPRING_SPEED, STOMP_BOUNCE_HELD, T, WALL_JUMP_FROM_LEVEL } from '../src/config.js';
import { WindZone } from '../src/entities/mechanics.js';
import { Player } from '../src/entities/Player.js';
import { Level } from '../src/world/Level.js';

const DT = 1 / 60;
const MAX_AIR_FRAMES = 300;
const MAX_NODES = 6000;

/** Input stub with the engine's isDown/justPressed/axis API. */
class FakeInput {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
  }
  set(dir, jump, press, down = false) {
    this.down.clear();
    this.pressed.clear();
    if (dir < 0) this.down.add(LEFT[0]);
    if (dir > 0) this.down.add(RIGHT[0]);
    if (jump) this.down.add(JUMP[0]);
    if (press) this.pressed.add(JUMP[0]);
    if (down) this.down.add(DOWN[0]);
  }
  isDown(k) {
    return (typeof k === 'string' ? [k] : k).some((c) => this.down.has(c) || this.pressed.has(c));
  }
  justPressed(k) {
    return (typeof k === 'string' ? [k] : k).some((c) => this.pressed.has(c));
  }
  axis(n, p) {
    return (this.isDown(p) ? 1 : 0) - (this.isDown(n) ? 1 : 0);
  }
}

/** Swap moving platforms for one-way tiles over their swept area. */
function patchMap(def) {
  const map = def.map.map((row) => [...row]);
  const put = (c, r, ch) => {
    if (r >= 0 && r < map.length && c >= 0 && map[r][c] === '.') map[r][c] = ch;
  };
  for (const o of def.objects ?? []) {
    if (o.type !== 'platform') continue;
    const dx = o.dx ?? 0;
    const dy = o.dy ?? 0;
    for (let r = Math.min(o.y, o.y + dy); r <= Math.max(o.y, o.y + dy); r++) {
      for (let c = Math.min(o.x, o.x + dx); c < Math.max(o.x, o.x + dx) + o.w; c++) put(c, r, '-');
    }
  }
  return { ...def, map: map.map((row) => row.join('')) };
}

export function setup(id) {
  const def = JSON.parse(readFileSync(`levels/${id}.json`, 'utf8'));
  const scene = new Scene();
  scene.ctx = { audio: { tone() {} } };
  const level = new Level(patchMap(def));
  scene.level = scene.add(level);
  scene.respawn = () => {};
  scene.camera.setBounds(0, 0, level.w, level.h);
  scene.winds = (def.objects ?? []).filter((o) => o.type === 'wind').map((o) => scene.add(new WindZone(o)));
  const solids = [];
  const switches = [];
  const springs = [];
  const gems = [];
  const lanes = [];
  let start = null;
  let flag = null;
  for (const { ch, x, y } of level.spawns) {
    if (ch === 'P') start = { x, y };
    else if (ch === 'G') gems.push(new Rect(x + 3, y + 2, 10, 12));
    else if (ch === 'F') flag = new Rect(x + 6, y - 2 * T, 4, 3 * T);
    else if (ch === 'S') springs.push(new Rect(x + 1, y + 8, 14, 8));
    else if (ch === '=' || ch === 's') {
      const block = { solid: true, crumble: ch === '=', pos: { x, y }, w: T, h: T, bounds: new Rect(x, y, T, T) };
      if (ch === 's') {
        block.bump = () => {
          if (scene.bumpCooldown > 0) return;
          scene.bumpCooldown = 15;
          level.toggleSwitchBlocks();
        };
        switches.push(block);
      }
      solids.push(block);
    } else if (ch === '<' || ch === '>') {
      const dir = ch === '<' ? -1 : 1;
      const r = y / T;
      let c = x / T + dir;
      while (c >= 0 && c < level.cols && !level.isSolid(c, r)) c += dir;
      const from = x + T * dir; // first tile in front of the muzzle
      const to = c * T; // the tile that stops the acorn
      lanes.push({ x0: Math.min(from, to), x1: Math.max(from, to) + T, y: y + 3 });
    }
  }
  level.solids.push(...solids);
  const arena = (def.objects ?? []).find((o) => o.type === 'arena');
  const goal = flag ?? (arena ? new Rect((arena.x + 3) * T, arena.y * T, arena.w * T, arena.h * T) : null);
  const wallJump = def.abilities?.wallJump ?? Number(id) >= WALL_JUMP_FROM_LEVEL;
  return { def, scene, level, start, goal, gems, springs, lanes, solids, wallJump, enemyGems: def.checker?.enemyGems ?? [] };
}

/** Run one macro from a standing state. Returns the landing state (or null) and what was touched on the way. */
export function simulate(env, node, macro, touched) {
  const { scene, level } = env;
  const p = scene.player;
  p.pos.set(node.x, node.y);
  p.vel.set(0, 0);
  p.onGround = true;
  p.platform = null;
  p.coyote = p.buffer = p.wallCoyote = p.wallLock = p.dropTimer = p.invuln = 0;
  p.hearts = 3;
  p.state = 'play';
  level.redOn = node.red;
  scene.bumpCooldown = 0;
  for (const s of env.solids) s.solid = true;
  let standingOn = null;
  let standFrames = 0;
  const input = new FakeInput();
  const ctx = { input, audio: scene.ctx.audio };
  let frame = 0;
  let left = false;
  let airDir = macro.air;
  let lastWallJump = -99;
  const total = macro.pre + MAX_AIR_FRAMES;
  for (; frame < total; frame++) {
    let dir = 0;
    let jump = false;
    let press = false;
    let down = false;
    if (macro.kind === 'wait') {
      // Stand still on a crumble block until it gives way.
      if (frame > 50 && p.onGround) return null;
    } else if (macro.kind === 'step') {
      // Walk a little and stop: gives standing positions right at ledge and hazard edges.
      dir = frame < macro.pre ? macro.dir : 0;
      if (frame >= macro.pre && p.onGround && Math.abs(p.vel.x) < 1) return { x: p.pos.x, y: p.pos.y, red: level.redOn };
      if (frame > macro.pre + 60) return null;
    } else if (frame < macro.pre) {
      dir = macro.dir;
    } else if (!left) {
      dir = macro.dir;
      if (macro.kind === 'walk' || macro.kind === 'coyote') {
        if (frame > macro.pre + 60) return null;
      } else if (macro.kind === 'drop') {
        down = true;
        press = frame === macro.pre;
        jump = press;
      } else {
        press = frame === macro.pre;
        jump = true;
      }
    } else {
      const airFrame = frame - macro.leftAt;
      dir = airFrame < macro.airDelay ? macro.dir : airDir;
      jump = airFrame < macro.hold;
      // Coyote jump: press jump a few frames after running off a ledge.
      if (macro.kind === 'coyote' && airFrame === 2) press = jump = true;
      if (macro.kind === 'coyote') jump = airFrame >= 2 && airFrame < 2 + macro.hold;
      if (macro.climb && env.wallJump && p.wallCoyote > 0 && !p.onGround && frame - lastWallJump > 8 && p.vel.y > -120) {
        press = jump = true;
        lastWallJump = frame;
        // zigzag: head for the opposite wall; same: drift back to the wall just jumped from.
        airDir = macro.climb === 'zigzag' ? -p.wallSide : p.wallSide;
        macro.hold = airFrame + 14;
      }
    }
    input.set(dir, jump, press, down);
    if (scene.bumpCooldown > 0) scene.bumpCooldown--;
    const prevBottom = p.pos.y + p.h;
    const hearts = p.hearts;
    p.update(DT, ctx);
    if (p.hearts < hearts || p.state !== 'play') return null;
    // Crumble blocks fall 0.5 s after being stood on.
    if (p.onGround && p.groundSolid?.crumble) {
      standFrames = p.groundSolid === standingOn ? standFrames + 1 : 1;
      standingOn = p.groundSolid;
      if (standFrames >= 30) standingOn.solid = false;
    } else {
      standFrames = 0;
    }
    for (const s of env.springs) {
      if (p.vel.y >= 0 && rectHit(p, s) && p.pos.y + p.h - s.y <= 8) {
        p.pos.y = s.y - p.h;
        p.bounce(SPRING_SPEED);
      }
    }
    for (const lane of env.lanes) {
      const bottom = p.pos.y + p.h;
      // Acorns come and go: only bounce when the macro is holding jump (choosing to stomp).
      if (jump && p.vel.y > 0 && prevBottom <= lane.y && bottom >= lane.y && p.pos.x + p.w > lane.x0 && p.pos.x < lane.x1) {
        p.pos.y = lane.y - p.h;
        p.bounce(STOMP_BOUNCE_HELD);
      }
    }
    for (let i = 0; i < env.gems.length; i++) if (rectHit(p, env.gems[i])) touched.add(`gem${i}`);
    if (env.goal && rectHit(p, env.goal)) touched.add('goal');
    if (!left && !p.onGround) {
      left = true;
      macro.leftAt = frame;
    }
    if (macro.kind === 'step') {
      if (!p.onGround) return null;
      continue;
    }
    if (macro.kind === 'wait' && !left) continue;
    if (left && p.onGround && frame - macro.leftAt > 2) {
      return { x: p.pos.x, y: p.pos.y, red: level.redOn };
    }
  }
  return null;
}

const rectHit = (p, r) => p.pos.x < r.x + r.w && p.pos.x + p.w > r.x && p.pos.y < r.y + r.h && p.pos.y + p.h > r.y;

function macros(wallJump) {
  const list = [];
  for (const dir of [-1, 1]) {
    list.push({ kind: 'walk', dir, pre: 0, air: dir, airDelay: 0, hold: 0 });
    for (const pre of [2, 5, 10]) list.push({ kind: 'step', dir, pre, air: 0, airDelay: 0, hold: 0 });
    for (const hold of [10, 60]) list.push({ kind: 'coyote', dir, pre: 0, air: dir, airDelay: 0, hold });
    if (wallJump) list.push({ kind: 'coyote', dir, pre: 0, air: dir, airDelay: 0, hold: 60, climb: 'zigzag' });
    for (const pre of [0, 6, 18]) {
      for (const hold of [3, 9, 16, 60, 150]) {
        for (const air of [-1, 0, 1]) list.push({ kind: 'jump', dir, pre, air, airDelay: air === dir ? 0 : 10, hold });
      }
    }
    if (wallJump) {
      for (const climb of ['zigzag', 'same']) list.push({ kind: 'jump', dir, pre: 0, air: dir, airDelay: 0, hold: 60, climb });
    }
  }
  for (const air of [-1, 0, 1]) list.push({ kind: 'jump', dir: 0, pre: 0, air, airDelay: 0, hold: 60 });
  list.push({ kind: 'drop', dir: 0, pre: 0, air: 0, airDelay: 0, hold: 0 });
  for (const air of [-1, 0, 1]) list.push({ kind: 'wait', dir: 0, pre: 0, air, airDelay: 0, hold: 0 });
  return list;
}

export function checkLevel(id) {
  const env = setup(id);
  const { scene, start, level } = env;
  scene.player = scene.add(new Player(start.x, start.y, { wallJump: env.wallJump }));
  const p = scene.player;
  const input = new FakeInput();
  for (let i = 0; i < 120 && !p.onGround; i++) p.update(DT, { input, audio: scene.ctx.audio });
  const first = { x: p.pos.x, y: p.pos.y, red: true };
  const key = (n) => `${Math.round(n.x / 3)},${Math.round(n.y)},${n.red ? 1 : 0}`;
  const seen = new Set([key(first)]);
  const queue = [first];
  const touched = new Set();
  const list = macros(env.wallJump);
  while (queue.length > 0 && seen.size < MAX_NODES) {
    const node = queue.shift();
    for (const m of list) {
      const next = simulate(env, node, { ...m }, touched);
      if (!next) continue;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  const missingGems = env.gems.map((_, i) => i).filter((i) => !touched.has(`gem${i}`) && !env.enemyGems.includes(i));
  return {
    id,
    nodes: seen.size,
    capped: seen.size >= MAX_NODES,
    goal: env.goal ? touched.has('goal') : null,
    gems: env.gems.length,
    gemsReached: env.gems.filter((_, i) => touched.has(`gem${i}`)).length,
    enemyGems: env.enemyGems,
    missingGems,
    level,
    def: env.def,
    reached: [...seen],
  };
}

/** Static rules from §5.1/§12 that don't need simulation. */
export function lint(id, def, level) {
  const problems = [];
  const count = (ch) => level.spawns.filter((s) => s.ch === ch).length;
  if (count('P') !== 1) problems.push(`needs exactly one P (has ${count('P')})`);
  const n = Number(id);
  if (n >= 1 && n <= 9 && count('G') !== 3) problems.push(`needs exactly 3 gems (has ${count('G')})`);
  if (n >= 1 && n <= 9 && count('F') !== 1) problems.push('needs a flag');
  const hazards = 'ehktbdp';
  const p = level.spawns.find((s) => s.ch === 'P');
  if (p) {
    for (const s of level.spawns) if (hazards.includes(s.ch) && s.x < 20 * T) problems.push(`enemy '${s.ch}' inside the first 20 tiles`);
    for (let r = 0; r < level.rows; r++) for (let c = 0; c < Math.min(20, level.cols); c++) if (level.at(c, r) === '^') problems.push(`spikes at ${c},${r} inside the first 20 tiles`);
  }
  if (n >= 5 && n <= 9) {
    const hearts = count('H');
    if (n >= 6 && hearts < count('C')) problems.push(`levels 6–10 need a heart after each checkpoint (${hearts} hearts, ${count('C')} checkpoints)`);
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : BUILT_LEVELS;
  let failed = false;
  for (const id of ids) {
    const t0 = performance.now();
    const res = checkLevel(id);
    const problems = lint(id, res.def, res.level);
    if (res.goal === false) problems.push('flag/goal NOT reachable');
    if (res.missingGems.length) problems.push(`gems not reachable: ${res.missingGems.join(', ')}`);
    const ms = Math.round(performance.now() - t0);
    const skipped = res.enemyGems.length ? ` (gems ${res.enemyGems.join(',')} need an enemy, not checked)` : '';
    console.log(`level ${id}: ${problems.length ? 'FAIL' : 'ok'}  goal=${res.goal} gems ${res.gemsReached}/${res.gems}${skipped}  nodes=${res.nodes}${res.capped ? ' (capped)' : ''}  ${ms}ms`);
    for (const pr of problems) console.log(`   - ${pr}`);
    failed ||= problems.length > 0;
  }
  process.exit(failed ? 1 : 0);
}

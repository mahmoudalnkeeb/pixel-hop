// Headless check of the player controller against the GDD §3.2/§3.3 metrics. Run: node test/physics.test.mjs
import assert from 'node:assert/strict';
import { Scene } from '../vendor/h3-engine.min.js';
import { JUMP, RIGHT, LEFT, DOWN, T } from '../src/config.js';
import { Level } from '../src/world/Level.js';
import { Player } from '../src/entities/Player.js';
import { MovingPlatform } from '../src/entities/MovingPlatform.js';

const DT = 1 / 60;
const silent = { tone() {} };
globalThis.performance ??= { now: () => Date.now() };

function world(map, { wallJump = false } = {}) {
  const scene = new Scene();
  scene.ctx = { audio: silent };
  scene.level = scene.add(new Level({ map }));
  const s = scene.level.spawns.find((sp) => sp.ch === 'P');
  scene.player = scene.add(new Player(s.x, s.y, { wallJump }));
  scene.respawn = () => {};
  scene.camera.setBounds(0, 0, scene.level.w, scene.level.h);
  return scene;
}

function input(held) {
  const set = new Set(held.down);
  const pressed = new Set(held.pressed);
  const has = (s, k) => (typeof k === 'string' ? s.has(k) : k.some((c) => s.has(c)));
  return {
    isDown: (k) => has(set, k) || has(pressed, k),
    justPressed: (k) => has(pressed, k),
    axis: (n, p) => (has(set, p) ? 1 : 0) - (has(set, n) ? 1 : 0),
  };
}

function step(scene, held = { down: [], pressed: [] }) {
  const ctx = { input: input(held), audio: silent };
  for (const e of scene.entities) e.update(dt(), ctx);
  scene._applyPendingChanges();
  function dt() { return DT; }
}

const flat = ['..........', '..........', '..........', '..........', '..........', '..P.......', '##########'];

// Settle on the ground.
{
  const s = world(flat);
  for (let i = 0; i < 30; i++) step(s);
  assert.ok(s.player.onGround, 'player lands on the floor');
  const groundY = s.player.pos.y;

  // Full jump: hold JUMP the whole time. GDD: about 57 px, 0.71 s air time.
  step(s, { down: [JUMP[0]], pressed: [JUMP[0]] });
  let minY = s.player.pos.y, frames = 1;
  while (!s.player.onGround && frames < 200) { step(s, { down: [JUMP[0]], pressed: [] }); minY = Math.min(minY, s.player.pos.y); frames++; }
  const height = groundY - minY, air = frames * DT;
  console.log(`full jump: ${height.toFixed(1)} px (${(height / T).toFixed(2)} tiles), air ${air.toFixed(2)} s`);
  assert.ok(height > 53 && height < 60, 'full jump ≈ 57 px');
  assert.ok(air > 0.66 && air < 0.76, 'air time ≈ 0.71 s');

  // Short hop: tap JUMP for one step. GDD: about 1.5 tiles.
  for (let i = 0; i < 10; i++) step(s);
  step(s, { down: [JUMP[0]], pressed: [JUMP[0]] });
  minY = s.player.pos.y;
  for (let i = 0; i < 60 && !s.player.onGround; i++) { step(s); minY = Math.min(minY, s.player.pos.y); }
  const hop = groundY - minY;
  console.log(`short hop: ${hop.toFixed(1)} px (${(hop / T).toFixed(2)} tiles)`);
  assert.ok(hop > 16 && hop < 32, 'short hop ≈ 1.5 tiles');
}

// Jump buffer: pressing jump 5 frames before landing still jumps.
{
  const s = world(['..P.......', '..........', '..........', '..........', '##########']);
  let landedFrame = -1;
  for (let i = 0; i < 120; i++) {
    const before = s.player.pos.y;
    // Press when 0.08 s from the floor: feet within ~6 px at max fall-ish speed
    const feet = s.player.pos.y + s.player.h;
    const press = landedFrame < 0 && feet > 4 * T - 8 && s.player.vel.y > 0 && !s.player.onGround;
    step(s, { down: press ? [JUMP[0]] : [], pressed: press ? [JUMP[0]] : [] });
    if (press) landedFrame = i;
    if (landedFrame >= 0 && s.player.vel.y < -200) { console.log('jump buffer: buffered jump fired'); break; }
    if (i === 119) assert.fail('buffered jump never fired');
    void before;
  }
}

// Coyote time: jump 3 frames after running off a ledge.
{
  const s = world(['..........', '..........', '..P.......', '####......', '####......', '####......']);
  for (let i = 0; i < 20; i++) step(s);
  let airFrames = 0, jumped = false;
  for (let i = 0; i < 120; i++) {
    const wantJump = airFrames === 3;
    step(s, { down: [RIGHT[0], ...(wantJump ? [JUMP[0]] : [])], pressed: wantJump ? [JUMP[0]] : [] });
    if (!s.player.onGround) airFrames++;
    if (s.player.vel.y < -200) { jumped = true; break; }
  }
  assert.ok(jumped, 'coyote jump works 3 frames after leaving a ledge');
  console.log('coyote time: late jump accepted');
}

// Drop through a one-way platform with Down + Jump, but not with Jump alone.
{
  const s = world(['..P.......', '..........', '----------', '..........', '..........', '##########']);
  for (let i = 0; i < 40; i++) step(s);
  assert.ok(s.player.onGround && s.player.pos.y + s.player.h === 2 * T, 'stands on one-way platform');
  step(s, { down: [DOWN[0], JUMP[0]], pressed: [JUMP[0]] });
  for (let i = 0; i < 40; i++) step(s);
  assert.equal(s.player.pos.y + s.player.h, 5 * T, 'dropped through to the floor');
  console.log('drop-through: ok');
}

// Wall slide caps fall speed; wall jump pushes away. Disabled when wallJump=false.
{
  const map = ['#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#P.......#', '##########'];
  for (const enabled of [true, false]) {
    const s = world(map, { wallJump: enabled });
    for (let i = 0; i < 20; i++) step(s);
    // Jump and hold left into the wall.
    step(s, { down: [JUMP[0], LEFT[0]], pressed: [JUMP[0]] });
    let maxFallOnWall = 0, wallJumped = false;
    for (let i = 0; i < 90; i++) {
      const p = s.player;
      const onWall = p.sliding;
      if (onWall) maxFallOnWall = Math.max(maxFallOnWall, p.vel.y);
      const jumpNow = enabled && onWall && p.vel.y > 30;
      step(s, { down: [LEFT[0], ...(jumpNow ? [JUMP[0]] : [])], pressed: jumpNow ? [JUMP[0]] : [] });
      if (jumpNow) { wallJumped = p.vel.x > 100 && p.vel.y < -250; break; }
    }
    if (enabled) {
      assert.ok(maxFallOnWall <= 60 + 1e-6 && maxFallOnWall > 0, 'wall slide capped at 60 px/s');
      assert.ok(wallJumped, 'wall jump launches away from the wall');
      console.log(`wall slide max ${maxFallOnWall.toFixed(1)} px/s, wall jump ok`);
    } else {
      assert.equal(maxFallOnWall, 0, 'no wall slide before level 5');
      console.log('wall abilities disabled when not unlocked');
    }
  }
}

// Riding a moving platform carries the player.
{
  const s = world(['..P.......', '..........', '..........', '..........', '..........', '..........']);
  const plat = new MovingPlatform({ x: 1, y: 3, w: 3, dx: 4, dy: 0, speed: 40, wait: 0 });
  s.entities.unshift(plat); plat.scene = s; plat._live = true;
  s.level.platforms.push(plat);
  for (let i = 0; i < 30; i++) step(s);
  assert.ok(s.player.onGround && s.player.platform === plat, 'landed on the platform');
  const offset = s.player.pos.x - plat.pos.x;
  for (let i = 0; i < 60; i++) step(s);
  assert.ok(Math.abs(s.player.pos.x - plat.pos.x - offset) < 0.01, 'carried with the platform');
  console.log(`platform carry: moved ${(plat.pos.x - T).toFixed(1)} px with it`);
}

// Pit: lose a heart and return to last safe ground.
{
  const s = world(['..........', '..P.......', '####......', '####......']);
  for (let i = 0; i < 20; i++) step(s);
  const safeX = s.player.pos.x;
  for (let i = 0; i < 200 && s.player.hearts === 3; i++) step(s, { down: [RIGHT[0]], pressed: [] });
  assert.equal(s.player.hearts, 2, 'pit costs one heart');
  assert.ok(s.player.pos.x <= 4 * T && s.player.pos.y < 2 * T, 'returned to solid ground');
  void safeX;
  console.log('pit recovery: ok');
}

console.log('\nall physics checks passed');

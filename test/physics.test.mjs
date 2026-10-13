// Headless check of the player controller against the GDD §3.2/§3.3 metrics. Run: node test/physics.test.mjs
import assert from 'node:assert/strict';
import { Scene } from '../vendor/h3-engine.min.js';
import { JUMP, RIGHT, LEFT, DOWN, RUN_SPEED, T } from '../src/config.js';
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

  // Full jump: hold JUMP the whole time. GDD: about 57 px, 0.75 s air time.
  step(s, { down: [JUMP[0]], pressed: [JUMP[0]] });
  let minY = s.player.pos.y, frames = 1;
  while (!s.player.onGround && frames < 200) { step(s, { down: [JUMP[0]], pressed: [] }); minY = Math.min(minY, s.player.pos.y); frames++; }
  const height = groundY - minY, air = frames * DT;
  console.log(`full jump: ${height.toFixed(1)} px (${(height / T).toFixed(2)} tiles), air ${air.toFixed(2)} s`);
  assert.ok(height > 53 && height < 60, 'full jump ≈ 57 px');
  assert.ok(air > 0.7 && air < 0.8, 'air time ≈ 0.75 s');

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
  assert.ok(s.player.onGround && Math.abs(s.player.pos.y + s.player.h - 2 * T) < 1e-6, 'stands on one-way platform');
  step(s, { down: [DOWN[0], JUMP[0]], pressed: [JUMP[0]] });
  for (let i = 0; i < 40; i++) step(s);
  assert.ok(Math.abs(s.player.pos.y + s.player.h - 5 * T) < 1e-6, 'dropped through to the floor');
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

  // Down + Jump on a moving platform jumps instead of dropping through it.
  step(s, { down: [DOWN[0], JUMP[0]], pressed: [JUMP[0]] });
  assert.ok(s.player.vel.y < -200 && s.player.dropTimer <= 0, 'down + jump on a moving platform is a jump');
  console.log('moving platform: down + jump jumps');
}

// Riding vertical platforms both ways: Hop stays on (descending ones used to drop him through).
for (const dy of [4, -4]) {
  const s = world(['..P.......', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........']);
  const plat = new MovingPlatform({ x: 1, y: dy > 0 ? 3 : 8, w: 3, dx: 0, dy, speed: 40, wait: 0 });
  s.entities.unshift(plat); plat.scene = s; plat._live = true;
  s.level.platforms.push(plat);
  for (let i = 0; i < 60 && !s.player.platform; i++) step(s);
  assert.ok(s.player.platform === plat, `landed on the ${dy > 0 ? 'descending' : 'rising'} platform`);
  for (let i = 0; i < 120; i++) {
    step(s);
    assert.ok(s.player.onGround && s.player.platform === plat, `stays on the ${dy > 0 ? 'descending' : 'rising'} platform (step ${i})`);
  }
}
console.log('vertical platforms: rider stays on both ways');

// Corner correction: a jump that clips the edge of a ceiling tile by a few px slides past it.
{
  const s = world(['..........', '..........', '...#......', '..........', '..........', '..........', '..P.......', '##########']);
  for (let i = 0; i < 20; i++) step(s);
  s.player.pos.x = 3 * T - s.player.w + 3; // head 3 px under the tile's left edge
  step(s, { down: [JUMP[0]], pressed: [JUMP[0]] });
  let minY = s.player.pos.y;
  for (let i = 0; i < 60 && !s.player.onGround; i++) { step(s, { down: [JUMP[0]], pressed: [] }); minY = Math.min(minY, s.player.pos.y); }
  assert.ok(minY < 3 * T - 2, 'slid past the corner instead of bonking at the tile');
  console.log('corner correction: ok');
}

// Ledge assist: falling with the feet just below a ledge top pops Hop up onto it.
{
  const s = world(['P.........', '..........', '..........', '......####', '......####', '......####']);
  const p = s.player;
  p.pos.set(6 * T - p.w - 1, 3 * T - p.h + 3); // feet 3 px below the ledge top, 1 px from the wall
  p.vel.set(RUN_SPEED, 20);
  step(s, { down: [RIGHT[0]], pressed: [] });
  for (let i = 0; i < 5; i++) step(s, { down: [RIGHT[0]], pressed: [] });
  assert.ok(p.onGround && p.pos.x > 6 * T - p.w, 'popped up onto the ledge');
  console.log('ledge assist: ok');
}

// Wall cling: once sliding, Hop keeps sliding without holding toward the wall.
{
  const s = world(['#.........', '#.........', '#.........', '#.........', '#.........', '#.........', '#.........', '#.P.......', '##########'], { wallJump: true });
  for (let i = 0; i < 20; i++) step(s);
  step(s, { down: [JUMP[0], LEFT[0]], pressed: [JUMP[0]] });
  for (let i = 0; i < 60 && !s.player.sliding; i++) step(s, { down: [LEFT[0]], pressed: [] });
  assert.ok(s.player.sliding, 'started sliding');
  for (let i = 0; i < 5; i++) step(s);
  assert.ok(s.player.sliding, 'still sliding with no input');
  step(s, { down: [RIGHT[0]], pressed: [] });
  assert.ok(!s.player.sliding, 'pushing away lets go');
  console.log('wall cling: ok');
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

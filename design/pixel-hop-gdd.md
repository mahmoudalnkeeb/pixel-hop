# Pixel Hop: Game Design Document

A 2D precision platformer in 10 levels, ending in a three-phase boss fight, built on the h3-engine JavaScript library. This document is self-contained: Appendix A explains how to get the engine, Appendix B lists the engine API the design relies on, and Appendix C gives reference code for the core systems.

| | |
| --- | --- |
| Genre | Side-scrolling precision platformer |
| Platform | Desktop and mobile browsers (Chrome, Firefox, Safari, Edge; iOS Safari 15+) |
| Engine | [h3-engine](https://github.com/mahmoudalnkeeb/h3-engine) v0.2.0, Canvas 2D backend (Appendix A) |
| Resolution | 320×180 logical, `scale: 'pixel'`, 16×16 tiles (20×11.25 tiles on screen) |
| Session length | 3–6 minutes per level; about 60–90 minutes for a first full run |
| Audience | Players who like Celeste-lite challenge and Mario-style readability |
| Monetization | Premium, or free web release. No ads in gameplay. |

---

## 1. Vision

**Pitch.** King Gloop, a bloated slime monarch, swallows the Sun Seed, and the meadow of Hopshire turns grey. Hop, a small red blob with big eyes and a bigger jump, crosses five lands to the King's throne to win it back.

**Pillars.** Every design decision should serve at least one of these:

1. **Tight, honest controls.** When the player dies, it's their fault and they know why. Coyote time, jump buffering and variable jump height are non-negotiable.
2. **One new idea per level.** Each level introduces a single mechanic, develops it, twists it, then tests it (see §5.1).
3. **Readable at 320×180.** Every hazard is recognisable from its silhouette and colour within one frame. Anything that hurts has spikes or red, and anything stompable has a soft, rounded top.
4. **Fast failure, fast retry.** Respawning takes under 1 second. Nothing in the game punishes the player with lost progress beyond the last checkpoint.

**Out of scope.** Combat beyond stomping, inventory, dialogue trees, procedural levels and online features.

---

## 2. Core loop

```
 ┌── Level select ◀──────────────────────────────┐
 │        │                                       │
 │        ▼                                       │
 │   Play level ──▶ die ──▶ respawn at checkpoint │
 │        │            (< 1 s)        │          │
 │        │◀──────────────────────────┘          │
 │        ▼                                       │
 │   Reach flag ──▶ Level clear summary ──────────┘
 │                (time, coins, gems, deaths)
 └── replay to find Sun Gems / beat par time
```

Moment to moment, the player runs, jumps, reads the next hazard, commits and lands. Within a level, the loop is: a new mechanic, a checkpoint, a combination with older mechanics, then the flag. Across the game, the player unlocks the next level, collects Sun Gems and reaches the boss.

---

## 3. Player

### 3.1 Controls

| Action | Keyboard (default) | Alternates | Touch (§9.4) |
| --- | --- | --- | --- |
| Move | ← → | A D | Left/right pads |
| Jump (hold for height) | Space | ↑, W, Z | A button |
| Drop through one-way platform | ↓ + Jump | S + Jump | Down + A |
| Pause | Esc | P | Pause icon |
| Confirm / Back (menus) | Enter / Esc | Space / Backspace | Tap |

All bindings can be remapped in Options. Each action is an array of `KeyboardEvent.code` strings (e.g. `const JUMP = ['Space', 'ArrowUp', 'KeyW', 'KeyZ']`), read with the engine's `input.axis(LEFT, RIGHT)`, `input.justPressed(JUMP)` and `input.isDown(JUMP)`. Remapping replaces the arrays.

### 3.2 Movement constants

These values come from a working prototype and already feel good; Appendix C.2 has the controller that uses them. New abilities are added on top. **Tune only through these constants**, and keep them in one `config.js`.

| Constant | Value | Notes |
| --- | --- | --- |
| `GRAVITY` | 900 px/s² | while rising |
| `FALL_GRAVITY` | 1250 px/s² | while falling: weighty, not floaty |
| `APEX_SPEED` / `APEX_GRAVITY` | 40 px/s / ×0.5 | gravity is halved near the top of the arc while jump is held: a short hang |
| `MAX_FALL` | 420 px/s | |
| `RUN_SPEED` | 110 px/s | about 6.9 tiles/s |
| `ACCEL_GROUND` / `ACCEL_AIR` | 2000 / 1200 px/s² | near-instant starts and turns |
| `FRICTION` | 2600 px/s² | stops in about 0.04 s |
| `JUMP_SPEED` | 320 px/s | full jump about 57 px, roughly **3.5 tiles** high |
| Jump cut | releasing jump caps upward speed at 80 px/s, after at least 0.07 s of rise | short hop about 1.6 tiles |
| `NUDGE` | 4 px | corner correction on head bumps; ledge assist when the feet clip a ledge |
| `COYOTE_TIME` | 0.08 s | |
| `JUMP_BUFFER` | 0.12 s | |
| `STOMP_BOUNCE` | 220 px/s (300 if jump held) | about 1.7 / 3.1 tiles |
| `SPRING_SPEED` | 480 px/s | about **8 tiles** high |
| `WALL_SLIDE_MAX` | 60 px/s | from level 5; once sliding, Hop clings until he pushes away |
| `WALL_JUMP` | vx 140 away from wall, vy 300 | the kick can't be steered for 0.12 s |
| `WALL_COYOTE` | 0.08 s | |
| Hitbox | 12×14 px | drawn 16×16; enemies hurt only inside a hurtbox 2 px smaller on the sides and top |

### 3.3 Level-design metrics (derived)

Every level is built to these numbers. A jump that's longer than "skill" is a bug.

| | Comfortable | Skill | Impossible |
| --- | --- | --- | --- |
| Gap, flat ground to flat ground | ≤ 3 tiles | 4 tiles | ≥ 5 tiles |
| Climb, single jump | ≤ 2 tiles | 3 tiles | ≥ 4 tiles |
| Gap with 1-tile drop | ≤ 4 tiles | 5 tiles | ≥ 6 tiles |
| Spring height | 7 tiles | 8 tiles | ≥ 9 tiles |
| Ceiling height above a running jump | ≥ 5 tiles | 4 tiles | ≤ 2 tiles (bonks) |

Full-jump air time is about 0.75 s, which covers roughly 82 px (5.1 tiles) of horizontal travel at full speed.

### 3.4 Health, death and retry

- **3 hearts.** Touching an enemy or spikes costs 1 heart, knocks Hop back (vx 120 away, vy 180) and gives 1.0 s of invulnerability, shown by flicker at 15 Hz.
- **Pits:** Hop loses 1 heart and is placed back on the last solid ground he stood on (track the last safe tile position).
- **0 hearts:** a death animation plays (0.5 s), then Hop respawns at the last checkpoint with 3 hearts. Coins and gems collected since that checkpoint are kept. Generosity beats realism.
- **No lives and no Game Over.** Deaths are counted per level and shown on the clear screen.
- **Heart pickups** restore 1 heart. Place one after each checkpoint in levels 6–10.

### 3.5 Abilities by level

| Level | Ability | How it's taught |
| --- | --- | --- |
| 1 | Run, variable jump, stomp | Flat start, then a slime on open ground, then a 1-tile step |
| 2 | Drop through one-way platforms | A coin trail under a one-way ledge with nowhere else to go |
| 5 | **Wall slide and wall jump** | A narrow shaft with no way out except up. A sign shows a ghost demo. |

There is no double jump: it would trivialise the metrics above.

---

## 4. World and objects

### 4.1 Tile and object legend

Levels are ASCII maps, one character per 16×16 tile and one string per row, wrapped in a JSON object so they load through the engine's `assets.json()`. Rows may differ in length; pad them with `.` when parsing.

| Char | Object | Solid | Notes |
| --- | --- | --- | --- |
| `.` | empty | | |
| `#` | ground | yes | autotiled by world palette |
| `B` | brick | yes | decorative variant of `#` |
| `-` | one-way platform | top only | drop through with ↓ + Jump |
| `^` | spikes | | 1 heart; only the lower half of the tile (8 px) hurts |
| `P` | player start | | one per level |
| `F` | goal flag | | |
| `C` | checkpoint | | lantern; lights up on touch, plays `checkpoint` |
| `o` | coin | | 10 pts |
| `G` | Sun Gem | | exactly 3 per level (levels 1–9); 500 pts |
| `H` | heart | | |
| `S` | spring | | launches at `SPRING_SPEED` |
| `=` | crumble block | yes | shakes 0.5 s after being stood on, falls, respawns after 3 s |
| `%` | fake wall | no | looks like `#` and hides secrets. Fades to 40% alpha when Hop is inside. |
| `R` / `U` | red / blue switch block | when active | red blocks start solid |
| `s` | switch | | hit from below or stomped; swaps red and blue blocks |
| `e` | Slime | | |
| `h` | Hopper slime | | |
| `t` | Thornback | | |
| `b` | Bat | | |
| `d` | Dropper | | hangs from the ceiling tile above it |
| `p` | Puffer | | |
| `<` / `>` | Acorn cannon facing left / right | yes | |
| `k` | Gloop Knight | | |

**Things defined outside the map** live in the level's `objects` array, because their paths and areas don't fit on a grid:

```json
{
  "id": "4-1",
  "name": "Sunken Ruins",
  "world": 2,
  "music": "music_woods",
  "par": 90,
  "map": ["....", "...."],
  "objects": [
    { "type": "platform", "x": 40, "y": 8, "w": 3, "dx": 6, "dy": 0, "speed": 40, "wait": 0.5 },
    { "type": "wind", "x": 60, "y": 0, "w": 12, "h": 11, "force": 220, "dir": -1 },
    { "type": "sign", "x": 12, "y": 9, "text": "Hold JUMP to jump higher" }
  ]
}
```

`x`, `y`, `w`, `h`, `dx` and `dy` are in tiles. `speed` is in px/s and `wait` is the pause in seconds at each end of a path.

### 4.2 Mechanics

| Mechanic | Behaviour | Debut |
| --- | --- | --- |
| One-way platform | Solid only when falling onto its top (this logic exists in `Level._collide`) | 1 |
| Spikes | Static hazard | 2 |
| Checkpoint lantern | Saves the respawn point. Touching a later lantern deactivates earlier ones. | 2 |
| Spring | Fixed launch. Holding jump doesn't change the height (it stays predictable). | 3 |
| Moving platform | Carries the player: add the platform's delta to anything standing on it before the player moves. Linear path with `wait` at each end. | 4 |
| Crumble block | 0.5 s shake (±1 px), then falls at gravity; respawns after 3 s with a 0.2 s fade-in | 4 |
| Wall slide / jump | See §3.2. Only works on `#` and `B`, never on `=` or switch blocks, so readings stay consistent. | 5 |
| Switch blocks | `s` toggles every `R` and `U` in the level. A block that turns solid while overlapping Hop pushes him up, or kills him if he can't move up (place them so this never happens). | 6 |
| Darkness (soft) | Cave levels draw a 60%-alpha dark overlay with a cut-out radius of 72 px around Hop, plus glowing crystals (radius 40 px). Use one overlay draw per frame (§9.3). | 6 |
| Wind zone | Adds `force` px/s² of horizontal acceleration while Hop is inside; leaf particles show direction and strength | 7 |
| Acorn cannon | Fires acorns that can be stomped and bounce Hop like a stomp: the core of the sky levels | 8 |
| Rising thornwater | An auto-rising hazard (16 px/s, then 24 px/s) in two sections of level 9. The camera biases upward. | 9 |

### 4.3 Enemies

All enemies are engine `Entity` subclasses tagged `enemy` (plus `stompable` where it applies), and contact is found with `Collision.check(scene, 'player', 'enemy', fn)`. A stomp counts when Hop is falling (`vel.y > 0`) and his bottom edge is less than 8 px below the enemy's top (`p.pos.y + p.h - enemy.pos.y < 8`). Any other contact hurts.

| Enemy | Look | Behaviour | Stompable | HP | Score | Debut |
| --- | --- | --- | --- | --- | --- | --- |
| **Slime** | Green blob | Walks at 30 px/s and turns at walls and ledges (this is the existing `Slime`) | ✔ | 1 | 100 | 1 |
| **Hopper** | Blue blob | Every 1.5 s hops toward the player (vx 60, vy 260) when within 8 tiles. Squashes 0.3 s before hopping. | ✔ | 1 | 150 | 2 |
| **Thornback** | Brown beetle with red spikes | Walks at 40 px/s. Its spiked back hurts from above. Avoid it or let it walk into a pit. | ✘ | – | – | 3 |
| **Bat** | Purple, flapping | Flies in a sine wave (amplitude 16 px, period 2 s) at 40 px/s and turns at walls. Sleeps upside down until the player is within 6 tiles. | ✔ | 1 | 150 | 5 |
| **Dropper** | Stone stalactite with eyes | When Hop is within 1 tile horizontally and anywhere below, it shakes 0.35 s, falls at 2× gravity and shatters. It doesn't come back. | ✘ (shatters) | – | 50 if dodged | 6 |
| **Puffer** | Grumpy cloud | Stationary. Every 2.5 s, if the player is within 10 tiles, it inflates for 0.4 s and fires a spore (80 px/s) aimed at Hop. | ✔ | 1 | 200 | 7 |
| **Acorn** (projectile) | Acorn | Flies straight at 90 px/s and disappears on walls | ✔ (bounce, no score) | 1 | 0 | 8 |
| **Gloop Knight** | Slime in a tin helmet | Walks at 35 px/s. The first stomp knocks the helmet off and it speeds up to 60 px/s; the second defeats it. | ✔✔ | 2 | 400 | 9 |

**Rules.**
- No enemy acts off-screen. Spawn and update only within the camera view expanded by 2 tiles (use `camera.view`).
- Consecutive stomps without touching the ground form a **chain**: the 1st scores 100, then 200, 400, 800, and every stomp after that is 1000. The SFX pitch rises with the chain (§8.4).
- Projectiles come from the engine's `Pool` so nothing allocates during a frame.

### 4.4 Collectibles and scoring

| Item | Score | Purpose |
| --- | --- | --- |
| Coin | 10 | Trail-lays the intended route; collecting all of them in a level earns the **Coin medal** |
| Sun Gem | 500 | 3 per level in levels 1–9, 27 total; each is hidden behind a fake wall, a hard optional jump or an off-path route |
| Heart | 50 if already full | Restores 1 heart |
| Level clear | 1000 + time bonus | Time bonus is `max(0, par − time) × 20` |

**Medals per level:** 3 Gems, All Coins, and Par Time. All 27 gems unlock the **True Ending** epilogue scene and the "Golden Hop" palette swap.

---

## 5. Level design

### 5.1 Method

Each level follows a four-beat structure (kishōtenketsu):

1. **Introduce:** a safe "teaching room" where failure costs nothing, such as a pit with a floor below or spikes beside the path.
2. **Develop:** the mechanic again with real stakes.
3. **Twist:** the mechanic combined with something already learned, or used in an unexpected way.
4. **Test:** a short final run before the flag, with a checkpoint right before it.

Global rules:
- **First screen safe:** nothing can hurt Hop within the first 20 tiles of any level.
- **Checkpoint rule:** never more than about 45 seconds of play between checkpoints at par pace.
- **No blind jumps:** whatever Hop lands on must be visible before he commits. The camera's `offsetY: -16` plus a look-ahead of `facing × 24 px` (lerped) keeps this true. Downward drops longer than 4 tiles need a coin trail.
- **Gem visibility:** at least one hint for each gem is visible from the main path, such as a gap in a wall pattern, a single coin, or a crack.
- **Height:** 12–18 rows per level, with the ground usually 3–4 rows from the bottom.

### 5.2 World overview

| World | Levels | Biome | Palette (sky / ground / accent) | Music |
| --- | --- | --- | --- | --- |
| 1 | 1–2 | Green Hills | `#6ec6ff` / `#8a5a2b` + `#5cc94e` / `#ff5e5b` | `music_hills` |
| 2 | 3–4 | Bramble Woods and Sunken Ruins | `#2e4a3a` / `#5b4632` + `#3f7d3a` / `#e0b84a` | `music_woods` |
| 3 | 5–6 | Crystal Caves | `#141625` / `#3b3a52` + `#6a6890` / `#6fe3ff` | `music_caves` |
| 4 | 7–8 | Cloud Ruins and Sky Bridge | `#ffd9a8` / `#e8e0f0` + `#b7a6d6` / `#ff8fb1` | `music_sky` |
| 5 | 9–10 | Storm Keep and Throne of Gloop | `#2a1f3d` / `#4b3b5c` + `#6d5a7e` / `#9be36b` | `music_keep`, `music_boss` |

### 5.3 Difficulty curve

Enemy density is enemies per 20 columns (one screen). Precision is the hardest jump required on the main path, using §3.3.

| Level | Length (cols) | Enemy density | Hazard density | Precision | Checkpoints | Par (s) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 110 | 1.0 | Low | Comfortable | 0 | 45 |
| 2 | 130 | 1.3 | Low–mid | Comfortable | 1 | 60 |
| 3 | 150 | 1.5 | Mid | Comfortable | 1 | 75 |
| 4 | 160 | 1.5 | Mid | Skill (rare) | 1 | 90 |
| 5 | 170 | 1.6 | Mid | Skill | 2 | 100 |
| 6 | 170 | 1.8 | Mid–high | Skill | 2 | 110 |
| 7 | 180 | 1.8 | High | Skill | 2 | 120 |
| 8 | 190 | 2.0 | High | Skill (chains) | 2 | 120 |
| 9 | 220 | 2.2 | Very high | Skill (sustained) | 3 | 180 |
| 10 | 60 + arena | 1.0 + boss | High | Skill | 1 + per phase | – |

There's a deliberate breather after spikes: **level 3 is easier than the end of level 2**, and **level 7 opens gentler than level 6's finale**. Each new world starts with a short relaxed stretch.

### 5.4 Level-by-level

#### Level 1: "Green Hills" (World 1)
- **Teaches:** running, variable jump, coins, stomping Slimes, pits.
- **Introduce:** a flat start with a coin arc above a 1-tile step that teaches holding jump. The first Slime walks toward Hop on flat ground with no pit nearby.
- **Develop:** 2-tile and 3-tile pits, with a coin trail drawing the arc. A Slime patrols between two pits.
- **Twist:** a brick tower that can only be climbed by stomping a Slime for the extra bounce height (`STOMP_BOUNCE` with jump held).
- **Test:** two Slimes and a 3-tile pit before the flag on a small hill.
- **Gems:** (1) above the start, reached by a full jump from the brick block; (2) inside a `%` wall at the end of the first hill; (3) at the bottom of a pit with a one-way ledge to climb back out (teaches that some pits are safe).
- **Notes:** the reference map for this level is in Appendix C.8. Keep its rhythm: short flat runs between each new obstacle.

#### Level 2: "Spike Valley" (World 1)
- **Teaches:** spikes, one-way platforms, drop-through, Hoppers, checkpoints.
- **Introduce:** spikes in a dip that Hop can walk around, then a one-way platform staircase.
- **Develop:** spike pits under one-way platforms. A coin trail runs below a ledge to teach ↓ + Jump.
- **Twist:** Hoppers guarding narrow one-way ledges, where timing their hop is the puzzle.
- **Test:** an ascending spike corridor with alternating one-way platforms.
- **Checkpoint:** at column 65.
- **Gems:** (1) beneath a one-way platform (drop-through required); (2) above a spike field, reached by a stomp-bounce off a Hopper; (3) through a `%` wall in the ceiling.

#### Level 3: "Bramble Woods" (World 2)
- **Teaches:** springs, Thornbacks.
- **Introduce:** the teaching room below. The spring is the only way over the wall.

```
..........................
.............ooo..........
..........................
...........######.........
...........######.........
...........######.........
..P....S...######...C.....
##########################
```

- **Develop:** springs over pits to high ledges. Thornbacks walk on lower routes, teaching "don't stomp spiky things" (the first one walks toward a pit and falls in).
- **Twist:** springs under a low ceiling that stop Hop early and turn the launch into a horizontal route. Also a Thornback walking on a platform above a spring.
- **Test:** a spring chain across three pits.
- **Checkpoint:** at column 75.
- **Gems:** (1) a spring launch straight up into a hidden canopy; (2) the end of a Thornback-patrolled tunnel; (3) a `%` tree trunk.

#### Level 4: "Sunken Ruins" (World 2)
- **Teaches:** moving platforms, crumble blocks.
- **Introduce:** a horizontal moving platform over a shallow, safe pit with a floor. Then a single crumble block over solid ground.
- **Develop:** vertical platforms up a ruin wall, and crumble bridges over spikes.
- **Twist:** riding a moving platform past crumble blocks that must be used before they fall, plus a platform that passes under a Slime ledge.
- **Test:** a three-platform relay with one crumble landing.
- **Checkpoint:** at column 80.
- **Gems:** (1) below a crumble bridge (fall to a hidden ledge); (2) the far end of a platform path, which needs a skill jump back; (3) a `%` ruin column.

#### Level 5: "Crystal Caves" (World 3)
- **Teaches:** wall slide and wall jump, Bats.
- **Introduce:** the shaft below. Hop drops into it from above, and the only exit is up. A sign shows a looping ghost demonstration.

```
###....###
###....###
###.o..###
###....###
###..o.###
###....###
###.o..###
###....###
###..C.###
##########
```

- **Develop:** shafts that get wider (up to 4 tiles), then a wall jump between two pillars over a pit. Bats in open caverns.
- **Twist:** wall jumps up a shaft lined with spikes on one side, and sleeping Bats that wake as Hop climbs past.
- **Test:** a climb out of the cave, ending on the flag ledge.
- **Checkpoints:** at columns 60 and 120.
- **Gems:** (1) the top of an optional tall shaft; (2) behind a Bat cavern's back wall (`%`); (3) a wall-jump route over the flag.
- **Note:** the first appearance of the darkness overlay is subtle here (30% alpha), and full in level 6.

#### Level 6: "Echo Mines" (World 3)
- **Teaches:** switch blocks, Droppers, darkness.
- **Introduce:** a red wall that blocks the way. A switch above it is hit from below, the red wall vanishes and blue steps appear.
- **Develop:** switching while airborne: platforms appear under Hop mid-jump. Droppers placed over safe floors first.
- **Twist:** a switch that's only reachable by wall jump, flipping the room from a climb into a fall. Droppers hang above switch blocks.
- **Test:** a dark corridor with crystals placed so the next landing is always lit.
- **Checkpoints:** at columns 55 and 115.
- **Gems:** (1) a blue-only alcove reached by flipping the switch twice; (2) a dark side tunnel (a crystal glints inside); (3) the top of a Dropper shaft after all the Droppers have fallen.

#### Level 7: "Cloud Ruins" (World 4)
- **Teaches:** wind zones, Puffers.
- **Introduce:** gentle tailwind on flat ground, then a headwind over a 2-tile gap that becomes a 3-tile gap in the wind.
- **Develop:** a vertical updraft column (negative-y wind) as a gentle elevator. Puffers on cloud platforms.
- **Twist:** crosswinds over spikes, and wind that pushes Hop into or away from walls during wall jumps.
- **Test:** a headwind gauntlet with Puffers firing across it.
- **Checkpoints:** at columns 60 and 125.
- **Gems:** (1) ride an updraft past the visible top of the level; (2) a Puffer-guarded island; (3) a `%` cloud.

#### Level 8: "Sky Bridge" (World 4)
- **Teaches:** acorn cannons and acorn bouncing.
- **Introduce:** a cannon firing acorns over flat ground. Stomping one bounces Hop up to a coin row.
- **Develop:** pits too wide to jump (6 tiles) that can only be crossed by bouncing on an acorn mid-air.
- **Twist:** two cannons firing in opposite directions to make an acorn ladder, plus crumble bridges under fire.
- **Test:** a long bridge with cannons, Puffers and wind combined.
- **Checkpoints:** at columns 65 and 130.
- **Gems:** (1) a triple-acorn chain to a high cloud; (2) under the bridge (drop through one-way bridge planks); (3) a wind-assisted long jump to a floating ruin.

#### Level 9: "Storm Keep" (World 5)
- **Teaches:** Gloop Knights, rising thornwater, and every earlier mechanic combined.
- **Structure:** three acts, each ending at a checkpoint.
  - **Act 1:** a courtyard with Gloop Knights, switch-block gates and Hoppers.
  - **Act 2 (climb):** rising thornwater at 16 px/s up a tower of wall jumps, springs and crumble blocks. The camera follows upward, and the water level stays visible at the bottom edge of the screen.
  - **Act 3:** the battlements, with wind, cannons and Bats in the storm. A second thornwater rise at 24 px/s up the final spire.
- **Checkpoints:** at columns 70 and 140, plus the top of the first climb.
- **Gems:** one per act, each needing that act's main mechanic used in an advanced way.
- **Rules:** the thornwater only starts when Hop passes a trigger column, and it resets when he respawns. No thornwater section lasts longer than 35 seconds at par pace.

#### Level 10: "Throne of Gloop" (World 5)
- **Throne Hall (60 columns):** a short walk with no new mechanics. Royal banners and two Gloop Knights end at a checkpoint lantern in front of the throne doors. The music cuts to a low drone.
- **Arena:** the boss fight (§6).

---

## 6. Boss: King Gloop

### 6.1 Overview

| | |
| --- | --- |
| Size | 48×40 px hitbox, drawn 56×48 with a crown |
| HP | 6 (two hits per phase) |
| Contact damage | 1 heart |
| How to hit | Stomp his head **only while Dazed**. At any other time a stomp counts as contact damage, which tells the player to wait for the opening. |
| On hit | White flash for 0.2 s, `camera.shake(3, 0.2)`, Hop bounces at vy 360, the boss is invulnerable for 1.0 s, then starts his next pattern |
| Target fight time | 2.5–4 minutes on a first attempt |

### 6.2 Arena

```
####################
#..................#
#..................#
#..................#
#..................#
#..................#
#.----........----.#
#..................#
#..................#
#..................#
#..................#
####################
```

The arena is 20×12 tiles: 320 px wide, which fills the screen. The camera is locked with `setBounds` on the arena and keeps the floor in view. The two one-way ledges at row 6 give Hop escape routes and stomp angles. In phase 3, the outer floor columns 1–2 and 17–18 turn into spikes.

### 6.3 Phases

Every attack has a **visual tell and a matching audio cue of at least 0.4 s** before it can hurt (§8.4, §9.5).

**Phase 1: "Royal Hop" (HP 6 → 4)**
1. **Hop × 3:** squash tell (0.4 s, `boss_tell_hop`), then a jump toward Hop's x position (air time 0.9 s, peak 4 tiles). On landing, two **shockwaves** (16×8 px) travel outward along the floor at 120 px/s. Jump over them or stand on a ledge.
2. **Belly-flop:** after the third hop he lands hard, with `camera.shake(4, 0.3)`, and is **Dazed for 2.0 s**: his crown wobbles, stars circle and his eyes spin.

**Phase 2: "Court of Slimes" (HP 4 → 2)**
- **Transition:** a roar for 2 s (invulnerable), with `camera.shake(3, 0.5)`, and one Heart drops onto a ledge.
1. He moves to the centre and **belches 3 Slimes** (cheeks puff for 0.5 s, then the Slimes land at random columns 3–16).
2. **Goo lob:** every 1.8 s he lobs a goo blob in an arc toward Hop's current position. Its landing spot shows a shadow 0.5 s ahead, and the blob splashes in a 1-tile radius.
3. Once all the minions are stomped, **or** after 10 s, he belly-flops toward Hop and is **Dazed for 1.6 s**.

**Phase 3: "Tantrum" (HP 2 → 0)**
- **Transition:** a roar, the outer floor turns into spikes, the music switches to `music_boss_final`, and everything runs ×1.25 faster.
1. **Charge:** he scrapes his foot and his eyes glow red (0.6 s tell, `boss_tell_charge`), then dashes across the arena at 220 px/s. Escape by jumping over him (he's only 2.5 tiles tall) or onto a ledge.
2. **Wall slam:** he hits the far wall and rocks fall from the ceiling in 4 random columns, never all of them next to each other. Shadow tells appear 0.6 s before each rock.
3. **Dazed for 1.4 s** after the slam.
4. On the final hit, a slow-motion moment plays (the game runs at ×0.3 for 0.8 s). He deflates to Slime size and spits out the Sun Seed.

### 6.4 Failure and retry

- **Phase checkpoints:** dying restarts the **current phase** with 3 hearts and the boss at that phase's starting HP. The phase intro is skipped on a retry.
- After **5 deaths in a single phase**, offer Assist Mode once (§9.5). Never force it.

### 6.5 Victory

Hop collects the Sun Seed and colour floods back across the screen. A tween animates a sepia-to-colour fill on an overlay rect. Then the `victory` jingle plays, the end scene shows stats (total time, deaths, coins, gems) and credits roll. With all 27 gems, a short True Ending epilogue shows Hopshire in full bloom.

---

## 7. Art direction

- **Resolution:** 320×180, 16×16 tiles, `new Game({ scale: 'pixel' })` and `camera.roundPixels = true` so pixel art stays crisp.
- **Sprites:** Hop is 16×16 with 8 animations: idle (4 frames), run (6), jump-up (1), jump-down (1), land (2), wall-slide (2), hurt (2) and die (6). Enemies have 2–6 frame cycles. Use one `SpriteSheet` per world plus a shared characters sheet, drawn with `r.sprite`. Few, shared sheets matter because Canvas 2D can only merge consecutive draws from the same image; switching images between draws breaks the browser's batching.
- **Readability:** hazards always combine a light-grey base with red tips. Stompable enemies have rounded tops, and non-stompable ones have spikes. The background uses 30% less saturation and contrast than gameplay layers.
- **Parallax:** 3 layers per world, scrolling at 0.1, 0.3 and 0.5 of the camera's speed (Appendix C.4).
- **Juice:** squash and stretch on jump and land (Appendix C.2). Dust puffs on landing and wall jumps, coin sparkles, and screen shake only for stomps (2 px), hurt (3 px) and boss slams (4 px). Shake can be turned off (§9.5).
- **UI font:** a bitmap pixel font, 8 px tall, drawn as sprites. Until it exists, use the `label()` text helper in Appendix C.5 as a fallback.

---

## 8. Sound design

### 8.1 Direction

The sound is a chiptune palette: square and pulse leads, triangle bass and noise percussion. The music is pre-composed, and the SFX are short and synthesized-sounding so they sit inside the music. Three rules:

1. **Every action answers within one frame.** Sound plays on the same step as the event.
2. **Information over decoration.** Every threat has its own sound: the player should be able to play the boss fight with their eyes half shut.
3. **Repetition fatigue is a bug.** Frequent sounds get random pitch (`rate` ±5%), cooldowns and voice limits.

### 8.2 Implementation

- **Prototype now:** every SFX below has `audio.tone()` parameters that work with the engine today, so the game has full placeholder audio from day one (starter code in Appendix C.6).
- **Production:** replace the tones with authored samples (`.mp3` for the widest browser support), loaded through the `Assets` manifest and played with `audio.play(key, { volume, rate })`.
- **Music:** looping files played with `audio.play(key, { loop: true })`. The engine gaps that matter here (separate music and SFX volume, fades, loop points) are listed in §10.

### 8.3 Music

| Key | Used in | Tempo | Key | Mood and instrumentation | Length / loop |
| --- | --- | --- | --- | --- | --- |
| `music_title` | Title, Options | 100 | C major | Hopeful, a little sleepy. Triangle arpeggios with a soft square melody. | 0:40 loop |
| `music_select` | Level select | 110 | F major | Bouncy walking bass, light percussion | 0:30 loop |
| `music_hills` | Levels 1–2 | 140 | G major | The main theme. Upbeat square lead, triangle bass, noise hats. | 1:20 loop |
| `music_woods` | Levels 3–4 | 128 | D Dorian | Earthy and curious. Pulse-12.5% lead, plucked arps. Quotes the main theme in minor. | 1:30 loop |
| `music_caves` | Levels 5–6 | 96 | A minor | Sparse and echoey. Delay-heavy triangle, droplet arps, almost no drums. | 1:40 loop |
| `music_sky` | Levels 7–8 | 150 | E♭ major | Soaring with a fast arpeggio bed. The main theme returns in half time. | 1:30 loop |
| `music_keep` | Level 9, Throne Hall | 160 | E minor | Driving and tense. Double-time hats, minor theme, low pulse bass. | 1:45 loop |
| `music_boss` | Boss phases 1–2 | 170 | C minor | King Gloop's theme: pompous and wobbly, with a brass-like square and comic tuba-style bass | 1:20 loop |
| `music_boss_final` | Boss phase 3 | 185 | C♯ minor | The same theme a semitone up, faster, with full drums | 1:00 loop |
| `jingle_clear` | Level clear | – | Follows the world's key | A rising run, an extended version of `fanfare()` (Appendix C.6) | 2.5 s, no loop |
| `jingle_victory` | Boss defeated | – | C major | The main theme as a triumphant major cadence | 6 s |
| `music_credits` | Credits / True Ending | 120 | G major | The main theme, gentle and full arrangement | 2:30 |

- **Main theme:** a single 4-bar motif that appears in every track, in different keys and tempos, so the soundtrack feels like one piece.
- **Transitions:** level start fades the music in over 0.5 s. On death the music keeps playing; it isn't restarted, so retries don't get tedious. At level clear the music stops and `jingle_clear` plays. Entering the boss arena gives 1.5 s of silence and a drone, then `music_boss` starts on the roar.
- **Loudness:** master the music about 6 dB below the SFX peak level so the SFX always cut through.

### 8.4 Sound effects

Prototype parameters map to `audio.tone({ freq, to, duration, type, volume })`. ✔ in the Starter column means the sound is in the starter code in Appendix C.6.

| ID | Trigger | Prototype tone | Production direction | Variation / rules | Starter |
| --- | --- | --- | --- | --- | --- |
| `jump` | Jump starts | 300→600, 0.10 s, square, 0.10 | Short upward blip with a soft attack | Pitch ±4% | ✔ |
| `land` | Landing after falling faster than 150 px/s | 160→90, 0.06 s, triangle, 0.08 | Soft thud plus a dust puff | Volume scales with landing speed | |
| `wall_slide` | While sliding | 1200→1100, 0.05 s, sawtooth, 0.03, every 0.12 s | Quiet scraping loop | Stops instantly on leaving the wall | |
| `wall_jump` | Wall jump | 350→700, 0.09 s, square, 0.10 | The jump sound plus a wood or stone tick | Pitch ±4% | |
| `coin` | Coin collected | 988→1319, 0.08 s, square, 0.10 | Classic two-note chime | **Chain pitch:** +1 semitone per coin within 0.4 s, up to +12, then reset | ✔ |
| `gem` | Sun Gem collected | 784→1568, 0.35 s, triangle, then 1175→2349, 0.35 s | Sparkling arpeggio | Music ducks 50% for 0.6 s | |
| `heart` | Heart collected | 523→1047, 0.2 s, triangle, 0.12 | Warm rising tone | | |
| `stomp` | Enemy stomped | 220→80, 0.12 s, square, 0.15 | Squelch | **Chain pitch:** +2 semitones per chain stomp | ✔ |
| `stomp_armor` | Knight helmet knocked off | 600→300, 0.08 s, square, 0.15 | Tin clang | | |
| `hurt` | Hop loses a heart | 300→120, 0.25 s, sawtooth, 0.15 | Crunchy downward blip | Music ducks 30% for 0.3 s | |
| `die` | 0 hearts | 440→80, 0.6 s, sawtooth, 0.15 | Descending wah | Music ducks 60% for 1 s | ✔ |
| `pit` | Fell into a pit | 600→100, 0.4 s, triangle, 0.12 | Falling whistle | | |
| `checkpoint` | Lantern lit | 523, 659, 784, each 0.08 s, triangle | Bright bell and whoosh | Only on the first activation | |
| `spring` | Spring launch | 200→900, 0.18 s, square, 0.14 | Boing | Pitch ±3% | |
| `crumble` | Crumble block starts shaking | 90→70, 0.5 s, sawtooth, 0.05 | Rumble, then a crack when it falls | One voice per block | |
| `platform` | Moving platform reverses | 140, 0.04 s, square, 0.04 | Mechanical clunk | Only if on screen | |
| `switch` | Switch hit | 880→440, 0.1 s, then 440→880, 0.1 s, square, 0.12 | Toggle click and swoosh | | |
| `blocks_on` | Blocks become solid | 330, 0.06 s, square, 0.08 | Thunk | Rate-limited to once per 0.1 s | |
| `bat_wake` | Bat wakes up | 1500→2000, 0.1 s, square, 0.06 | Squeak | | |
| `dropper_tell` | Dropper shaking | 2000→1800, 0.35 s, triangle, 0.05 | Pebbles trickling | **Plays for the full tell** | |
| `dropper_crash` | Dropper shatters | 400→60, 0.2 s, sawtooth, 0.12 | Rock crash | | |
| `puffer_tell` | Puffer inflates | 200→500, 0.4 s, sine, 0.08 | Inhale | **Plays for the full tell** | |
| `spore` | Spore fired | 700→350, 0.08 s, square, 0.07 | Pop | | |
| `cannon` | Acorn fired | 120→60, 0.12 s, square, 0.12 | Muffled boom | Only within 1 screen | |
| `wind` | Inside a wind zone | Production only (looping noise) | Filtered noise loop, volume scales with force | Fades in and out over 0.3 s | |
| `thornwater` | Thornwater rising | Production only | Low bubbling loop that gets louder as the gap closes | | |
| `flag` | Goal reached | `fanfare()` (Appendix C.6) | Then `jingle_clear` | Stop all loops | ✔ |
| `ui_move` | Menu cursor | 660, 0.03 s, square, 0.06 | Tick | | |
| `ui_confirm` | Menu confirm | 660→990, 0.06 s, square, 0.08 | | | |
| `ui_back` | Menu back | 990→660, 0.06 s, square, 0.08 | | | |
| `pause` | Pause and unpause | 440, 0.05 s, triangle, 0.08 | Music filtered (production) or ducked 70% while paused | | |

**Boss SFX**

| ID | Trigger | Prototype tone | Production direction |
| --- | --- | --- | --- |
| `boss_roar` | Phase intro | 120→60, 1.2 s, sawtooth, 0.2 | Comic, wobbly bellow |
| `boss_tell_hop` | Squash before a hop (0.4 s) | 300→150, 0.4 s, sine, 0.12 | Rising rubbery stretch |
| `boss_land` | Hop landing | 80→40, 0.3 s, square, 0.2 | Heavy splat |
| `shockwave` | Shockwave travelling | 150, 0.5 s, sawtooth, 0.06 | Rolling rumble, panned with the wave (production) |
| `boss_dazed` | Dazed starts | 1200→1500→1200, 3 × 0.1 s, triangle | Cartoon "tweety" stars |
| `boss_hit` | Successful stomp | 160→60, 0.25 s, square, 0.2, plus `stomp` | Big squelch and crown clank |
| `boss_belch` | Spawning minions | 90→200, 0.5 s, sawtooth, 0.15 | Gross, comic |
| `goo_lob` | Goo launched | 400→250, 0.15 s, sine, 0.1 | Wet "thwop" |
| `goo_splash` | Goo lands | 200→60, 0.15 s, square, 0.1 | Splat |
| `boss_tell_charge` | Foot scrape (0.6 s) | 60→90, 0.6 s, sawtooth, 0.15 | Scrape and snort |
| `boss_charge` | Dashing | 100, 0.6 s, square, 0.12 | Stampede |
| `wall_slam` | Hits the wall | 60→30, 0.5 s, square, 0.25 | Huge crash |
| `rock_tell` | Rock shadow appears | 1800→1600, 0.6 s, triangle, 0.05 | Crumbling above |
| `boss_defeat` | Final hit | 400→40, 2.0 s, sawtooth, 0.2 | Long deflating raspberry, then `jingle_victory` |

### 8.5 Mix and voices

| Bus | Default volume | Contents |
| --- | --- | --- |
| Music | 0.6 | Tracks and jingles |
| SFX | 1.0 | Gameplay sounds |
| UI | 0.8 | Menu sounds |

- **Voice limits:** at most 4 simultaneous `coin`, 2 `stomp` and 3 `cannon`. The same ID can't retrigger within 30 ms.
- **Distance:** enemy sounds play only within 1.5 screens of Hop, at volume `1 − d / (1.5 × 320)`.
- **Ducking:** follows the table above. Duck and restore over about 80 ms to avoid clicks (needs a gain ramp; see §10).

---

## 9. Systems and UI

### 9.1 Scenes

They map onto the engine's `game.scenes` (`switch` replaces the stack, `push` overlays a scene, `pop` returns to the one below).

| Scene | Type | Notes |
| --- | --- | --- |
| `title` | switch | Logo, "Press Start", main theme |
| `select` | switch | World map with 10 nodes. Shows medals per level. Locked levels are greyed out. |
| `play` | switch | Takes `{ level }` |
| `pause` | push | Resume, Restart from checkpoint, Restart level, Options, Quit to map |
| `clear` | push | Time, par, coins x/y, gems 0–3, deaths. Medals animate in with tweens. |
| `options` | push | Music / SFX / UI volume, screen shake, Assist Mode, controls remap |
| `boss_intro` | push | 3 s non-interactive intro the first time only; skippable after the first view |
| `ending` | switch | Victory, stats, credits, True Ending if earned |

### 9.2 HUD

```
♥♥♡   ◎ 23/48   ◆◇◇                 01:12
```

From left to right: hearts, then coins for this level, then gems found (3 slots), then the timer (can be hidden in Options). Draw with `r.text` or bitmap-font sprites in screen space, from the scene's `render`. The HUD hides itself during the boss intro, and the boss's HP bar (6 segments) appears at the top centre during the fight.

### 9.3 Performance budget

| Item | Budget |
| --- | --- |
| Frame rate | 60 fps steady on a 2019 mid-range phone |
| Draw calls per frame | Under 1,500. Canvas 2D typically starts to struggle at several thousand draw calls per frame, sooner on mobile. |
| Tiles | Draw only tiles inside `camera.view` (Appendix C.1), at most about 300 per frame |
| Active entities | Under 80 updating; cull outside `camera.view` + 2 tiles |
| Allocation | No per-frame allocations in update or render. Particles and projectiles come from `Pool`. |
| Darkness overlay | One overlay draw per frame: prebuild the cut-out on an offscreen canvas and draw it with `r.image`. This uses `CanvasRenderer`; keep it in one function so a future backend can replace it. |
| Load | Each world's assets are loaded on the level-select screen. Total download under 6 MB. |

### 9.4 Platform

- **Touch:** semi-transparent on-screen buttons (left, right, down, A, pause) drawn in screen space, with pointer input. Shown automatically on the first touch event.
- **Focus loss:** the engine already pauses the game while the tab is hidden. The game should also open the pause menu when focus returns.
- **Resolution:** `scale: 'pixel'` with letterboxing. Test at 1×, 2×, 3× and 4× integer scales.

### 9.5 Accessibility

- **Assist Mode** (Options, or offered after repeated deaths), with independent toggles: game speed 100% / 85% / 70%, extra hearts (5), invincibility, and skip level. No achievements or medals are lost. Clear screens show a small assist icon only for transparency.
- **Screen shake:** on, reduced (50%) or off.
- **Flashing:** reduce invulnerability flicker to an outline and limit the boss hit flash to 1 frame.
- **Colour:** hazards are distinguished by shape as well as colour, and switch blocks have different patterns (dots for red, stripes for blue).
- **Audio:** every telegraph has an audio cue, and an optional caption line shows boss cues (e.g. "[King Gloop scrapes his foot]").
- **Controls:** full remapping, with either jump key usable.

### 9.6 Save data

Save to `localStorage` under a single key, versioned:

```json
{
  "version": 1,
  "levels": {
    "1": { "cleared": true, "bestTime": 41.2, "gems": [true, false, true], "allCoins": true, "deaths": 3 }
  },
  "unlocked": 2,
  "options": { "music": 0.6, "sfx": 1.0, "ui": 0.8, "shake": "on", "assist": { "speed": 1, "hearts": 3, "invincible": false }, "keys": {} },
  "bossBeaten": false
}
```

Save on level clear, on gem pickup (the gem counts even if the level isn't cleared), and when options change. Never save mid-level. Ignore and back up saves whose `version` is unknown.

---

## 10. Engine gaps

What h3-engine 0.2.0 doesn't provide yet, and where each item should be built. "Game" means it lives in the game's code; "Engine" means it's worth contributing back to h3-engine.

| Need | Where | Priority | Notes |
| --- | --- | --- | --- |
| Music, SFX and UI volume buses | Engine (`Audio`) | P0 | `Audio` has one master volume. Add named buses (a `GainNode` each). |
| Fades and gain ramps (fade in, ducking) | Engine (`Audio`) | P0 | Return a handle with a gain node, and add a fade on that handle. |
| Loop points | Engine (`Audio`) | P1 | `loopStart` and `loopEnd` on `play()`, because MP3 padding breaks seamless loops. |
| Bitmap font | Game | P1 | A sprite-based `text` helper |
| Moving-platform carry, wall slide, one-way drop | Game (`Level`/`Player`) | P0 | Extends `Level.moveAndCollide` in Appendix C.1 |
| Save helper | Game (possibly engine later) | P1 | A small wrapper around `localStorage` with versioning |
| Gamepad input | Engine (`Input`) | P2 | Not planned in the engine before 1.0. Keyboard and touch cover launch. |
| Tiled map import | Engine or a build script | P2 | The ASCII plus JSON format (§4.1) is enough for 10 levels |
| Offscreen layer caching (darkness, static tiles) | Game, behind a helper | P1 | Uses `CanvasRenderer`; isolate it for a future WebGL backend |
| On-screen touch controls | Game | P1 | |
| Particles | Game (entities + `Pool`) | P1 | Small entities with velocity, gravity and a lifetime that fade with `r.alpha` and `destroy()` themselves |

---

## 11. Production plan

| Milestone | Scope | Exit criteria |
| --- | --- | --- |
| **M0: Foundations** (1 week) | Repo set up on h3-engine 0.2.0, JSON level format and loader, player with every ability, debug overlay watches (`debug.watch`) for velocity and state | Every movement constant in one file. The level-1 greybox is playable. |
| **M1: Vertical slice** (3 weeks) | Levels 1–2 and boss phase 1 at final quality: art, music, SFX, HUD, pause, save | Five external playtesters finish level 2 without help. 60 fps on the target phone. |
| **M2: Content complete** (6 weeks) | All 10 levels greyboxed, then dressed; all enemies; full boss; all scenes | Every level can be completed, and every gem reached, with the tools available at that point |
| **M3: Polish and beta** (3 weeks) | Juice, accessibility, touch controls, balance from playtest data (deaths per checkpoint segment) | No segment's median deaths above 8. No P0 or P1 bugs. |
| **M4: Release** (1 week) | Build, size check, browser matrix, store or itch page | §12 is green |

**Playtesting.** Record deaths per checkpoint segment and time per segment in a debug export. Any segment where median deaths exceed 8 or median time exceeds 2× par gets redesigned, not just nerfed.

---

## 12. Acceptance checklist (per level)

- [ ] The first 20 tiles are safe.
- [ ] No jump on the main path exceeds the "skill" metrics in §3.3, and no level before 5 requires a wall jump.
- [ ] Each of the 3 gems is reachable, has a visible hint, and doesn't need abilities from later levels.
- [ ] There are no softlocks: every pit, switch state and crumble state has a way out or a respawn.
- [ ] Checkpoints are at most 45 s apart at par pace.
- [ ] Every enemy and hazard has a telegraph of at least 0.4 s, with a sound.
- [ ] 60 fps with the debug overlay on, and no allocations while running.
- [ ] Music loops cleanly, and no SFX clips during dense moments (chain stomps, cannon fire).
- [ ] It works on keyboard and touch, at 1× to 4× scale, in Chrome, Firefox and Safari.

---

## Appendix A: Getting the engine

h3-engine is a small 2D engine for the HTML canvas, written in plain JavaScript (ES modules) with no runtime dependencies. It isn't published on npm. Vendor the prebuilt bundle into the game repo:

1. Download `h3-engine.min.js` and `h3-engine.min.js.map` (or the readable `h3-engine.js`) from the v0.2.0 release: <https://github.com/mahmoudalnkeeb/h3-engine/releases/tag/v0.2.0>.
2. Put them in `vendor/` and import from there:

   ```js
   import { Game, Scene, Entity, Collision, Pool } from './vendor/h3-engine.min.js';
   ```

3. Serve the game over HTTP during development (ES modules and `fetch` don't work from `file://`). Any static server works, e.g. `npx serve .`.
4. Optional, for editor types: clone the engine at tag `v0.2.0` and run `npm install && npm run build`. That creates `dist/types/`, which you can point `jsconfig.json`/`tsconfig.json` at.

Upgrading means replacing the files in `vendor/` and reading the engine's `CHANGELOG.md`. Before 1.0, minor versions may contain breaking changes.

**Minimal bootstrap:**

```html
<!doctype html>
<html>
  <body style="margin:0;background:#000;display:grid;place-items:center;height:100vh">
    <canvas id="game"></canvas>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

```js
// src/main.js
import { Game } from '../vendor/h3-engine.min.js';
import { PlayScene } from './scenes/PlayScene.js';
import { TitleScene } from './scenes/TitleScene.js';

const game = new Game({ canvas: '#game', width: 320, height: 180, scale: 'pixel', background: '#6ec6ff' });
game.scenes.add('title', TitleScene).add('play', PlayScene);
game.start('title');
```

---

## Appendix B: Engine API used by this design (v0.2.0)

Units throughout: time in seconds, distance in logical pixels, angles in radians (clockwise).

### Game

| API | Notes |
| --- | --- |
| `new Game({ canvas, width, height, scale, background, step, debug, renderer })` | `canvas` is a selector or element (created if omitted). `scale`: `'fit'`, `'pixel'` (whole-pixel scaling, smoothing off) or `'none'`. `step` defaults to `1/60` (fixed timestep). `debug: true` shows the overlay at start. `renderer` defaults to `CanvasRenderer`. |
| `game.start(key?, data?)` | Attaches input, audio and resize listeners, starts the loop, optionally switches to a scene |
| `game.pause()`, `game.resume()`, `game.stop()` | The game also pauses automatically while the tab is hidden |
| `game.on(type, fn)` / `game.emit(type, ...args)` | Event bus. The engine emits `'pause'`, `'resume'`, `'stop'` and `'resize'`. |
| `game.scenes`, `game.input`, `game.audio`, `game.assets`, `game.renderer`, `game.debug`, `game.loop` | Subsystems. `game.loop.fps`/`ups` are measured rates. |

### Scenes

| API | Notes |
| --- | --- |
| `game.scenes.add(key, SceneClass)` | Chainable |
| `game.scenes.switch(key, data)` / `push(key, data)` / `pop(data)` | `switch` replaces the whole stack. `push` draws the new scene on top (for pause menus). `pop` calls `resume(data)` on the scene below. All scenes in the stack draw; only the top one updates. |
| `class X extends Scene` hooks | `preload(assets)` (return a promise to show the built-in loading bar), `enter(data)`, `update(dt, ctx)`, `render(r, alpha)` (screen space, after entities), `exit()`, `resume(data)` |
| `scene.add(entity)` / `remove(entity)` / `clear()` | Adds and removes during an update are deferred to the end of the step |
| `scene.find(tag)` / `first(tag)` / `count(tag)` | Tag queries |
| `scene.camera` | One camera per scene (below) |
| `scene.timer.after(s, fn)` / `every(s, fn)` | Return `{ cancel(), done }`. Pause with the game and die with the scene. |
| `scene.tween(target, props, duration, ease, { delay, onUpdate, onComplete })` | Animates numeric props; awaitable. Eases: `linear`, `quadIn`, `quadOut`, `quadInOut`, `cubicIn`, `cubicOut`, `cubicInOut`, `sineInOut`, `backOut`, `elasticOut`, or a custom `t => t` function. |
| `this.ctx` | `{ game, input, assets, renderer, audio, events, scene, camera }`, also passed to every `update(dt, ctx)` |

### Entities and collision

| API | Notes |
| --- | --- |
| `new Entity({ x, y, w, h, z, tags, shape, radius })` | `x`/`y` is the hitbox's top-left corner. `z` sets draw order. `shape` is `'rect'` or `'circle'`. |
| Fields | `pos` and `vel` (`Vec2`), `w`, `h`, `visible`, `active`, `debug` (show in overlay), `dead`, `scene`, `tags` (a `Set`) |
| `update(dt, ctx)` | Default moves `pos` by `vel * dt`; call `super.update(dt)` to keep that |
| `render(r, alpha)` | Draws in world space (the camera transform is applied) |
| `drawDebug(r, color, lineWidth)` | Override to add debug drawing (velocity lines, sensors) |
| `has(tag)`, `tag(tag)`, `untag(tag)`, `destroy()`, `cx`, `cy`, `bounds` | |
| `Collision.check(scene, tagA, tagB, (a, b) => …)` | Every overlapping pair between two tags |
| `Collision.overlaps(a, b)`, `aabb`, `circle`, `circleRect`, `pointInRect(px, py, rect)` | Overlap tests |
| `Collision.resolve(mover, obstacle, axis?)` | Pushes `mover` out of `obstacle`; returns the side of the obstacle that was hit (`'top'` means the mover landed on it) or `null` |

### Rendering (`r` in render hooks)

| API | Notes |
| --- | --- |
| `r.rect(x, y, w, h, color)`, `r.strokeRect(…, color, lineWidth)` | Colors are CSS strings |
| `r.circle(x, y, radius, color)`, `r.strokeCircle(…)`, `r.line(x1, y1, x2, y2, color, lineWidth)`, `r.poly([x0, y0, x1, y1, …], color)` | |
| `r.text(str, x, y, { font, color, align, baseline })` | `font` is a CSS font shorthand. Defaults: `'16px sans-serif'`, `'#fff'`, `'left'`, `'top'`. |
| `r.image(img, x, y, { w, h, sx, sy, sw, sh, originX, originY, rotation, flipX, flipY, alpha })` | |
| `r.sprite(sprite, x, y, options)` | Draws a `Sprite` or a sprite-sheet frame |
| `r.push()` / `r.pop()`, `r.translate`, `r.rotate`, `r.scale`, `r.alpha` | Transform and opacity stack |
| `r.ctx` | Raw `CanvasRenderingContext2D`, for anything not wrapped (gradients, clipping, offscreen canvases). Canvas backend only. |
| `new SpriteSheet(image, { frameW, frameH, margin, spacing, originX, originY })`, `sheet.frame(i)` | |
| `new Animation(sheet, { idle: { frames: [0, 1], fps: 4 }, die: { frames: [6, 7], fps: 8, loop: false } })` | `anim.play(name)`, `anim.update(dt)`, `r.sprite(anim.current, x, y)`, `anim.onComplete = (name) => …` |

### Camera (`scene.camera`)

| API | Notes |
| --- | --- |
| `follow(entity, { lerp, offsetX, offsetY })` | `follow(null)` stops following |
| `snap()` | Jump to the target instantly (use after spawning) |
| `setBounds(x, y, w, h)`, `clearBounds()` | Keep the view inside the level |
| `shake(intensity, duration)` | Pixels and seconds |
| `zoom`, `roundPixels`, `x`, `y` | `x`/`y` is the view centre |
| `view` | Visible world rectangle for culling. It's a shared object, so copy any values you keep. |
| `screenToWorld(x, y)`, `worldToScreen(x, y)` | |

### Input (`ctx.input`)

| API | Notes |
| --- | --- |
| `isDown(keys)`, `justPressed(keys)`, `justReleased(keys)` | `keys` is a `KeyboardEvent.code` string or an array of them. "Just" states last for one fixed step and never drop a short tap. |
| `axis(negativeKeys, positiveKeys)` | Returns -1, 0 or 1 |
| `anyPressed()` | For "press any key" screens |
| `pointer` | `{ x, y, worldX, worldY, down, justPressed, justReleased }` (mouse and touch) |

### Assets and audio

| API | Notes |
| --- | --- |
| `assets.load({ images: { key: url }, audio: { key: url }, json: { key: url } }, onProgress)` | Already-loaded keys are skipped. Usually called from `Scene.preload`. |
| `assets.image(key)`, `assets.sound(key)`, `assets.json(key)`, `assets.has(type, key)`, `assets.progress` | |
| `audio.play(keyOrBuffer, { volume, loop, rate })` | Returns a handle for `audio.stop(handle)`. `rate` also shifts pitch. |
| `audio.tone({ freq, to, duration, type, volume })` | Synthesized blip; `type` is `'sine'`, `'square'`, `'sawtooth'` or `'triangle'` |
| `audio.volume`, `audio.muted` | One master volume (see §10) |
| Unlocking | Browsers keep audio silent until a user gesture; the engine unlocks on the first key or pointer press. Sounds played before then are dropped, so the title screen must wait for input. |

### Utilities

| API | Notes |
| --- | --- |
| `new Pool(factory, size, reset)`, `pool.get()`, `pool.release(obj)` | Reuse objects in hot paths |
| `Vec2` (`set`, `addScaled`, …), `Rect` (`set`, …) | |
| `clamp`, `lerp`, `approach(value, target, step)`, `rand(min, max)`, `randInt(min, max)`, `pick(list)`, `angle`, `dist` | |
| `game.debug.watch(label, () => value)`, `unwatch(label)`, `ignoreTags` | Debug overlay, toggled with the backquote key |

---

## Appendix C: Reference implementations

Working code from the prototype the movement numbers came from. Use it as the starting point for the systems in §3–§4. Imports assume the engine is vendored as in Appendix A.

### C.1 Level: ASCII tiles and per-axis collision

```js
import { Collision, Entity, Rect } from '../vendor/h3-engine.min.js';

export const T = 16;
const SPAWN_CHARS = 'PeoF'; // extend with every object character from §4.1

export class Level extends Entity {
  constructor(map) {
    const cols = Math.max(...map.map((row) => row.length));
    super({ w: cols * T, h: map.length * T, z: 0 });
    this.cols = cols;
    this.rows = map.length;
    this.spawns = []; // { ch, x, y } in pixels
    this.grid = map.map((line, r) =>
      [...line.padEnd(cols, '.')].map((ch, c) => {
        if (SPAWN_CHARS.includes(ch)) {
          this.spawns.push({ ch, x: c * T, y: r * T });
          return '.';
        }
        return ch;
      }),
    );
    this._tile = new Rect();
    this._hit = { wall: '', ground: false, ceiling: false };
  }

  /** The left and right edges act as walls; above and below are open. */
  at(c, r) {
    if (c < 0 || c >= this.cols) return '#';
    if (r < 0 || r >= this.rows) return '.';
    return this.grid[r][c];
  }

  isSolid(c, r) {
    const t = this.at(c, r);
    return t === '#' || t === 'B';
  }

  /** Move X then Y, pushing out of tiles. Returns a shared { wall, ground, ceiling }. */
  moveAndCollide(e, dt) {
    const hit = this._hit;
    hit.wall = '';
    hit.ground = hit.ceiling = false;
    e.pos.x += e.vel.x * dt;
    this._collide(e, 'x', 0);
    const prevBottom = e.pos.y + e.h;
    e.pos.y += e.vel.y * dt;
    this._collide(e, 'y', prevBottom);
    return hit;
  }

  _collide(e, axis, prevBottom) {
    const hit = this._hit;
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    const r0 = Math.floor(e.pos.y / T);
    const r1 = Math.floor((e.pos.y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = this.at(c, r);
        let solid = t === '#' || t === 'B';
        // One-way platforms only stop things falling onto them from above.
        if (t === '-' && axis === 'y' && e.vel.y >= 0 && prevBottom <= r * T + 0.01) solid = true;
        if (!solid) continue;
        const side = Collision.resolve(e, this._tile.set(c * T, r * T, T, T), axis);
        if (!side) continue;
        if (axis === 'x') {
          e.vel.x = 0;
          hit.wall = side;
        } else if (side === 'top') {
          e.vel.y = 0;
          hit.ground = true;
        } else {
          if (e.vel.y < 0) e.vel.y = 0;
          hit.ceiling = true;
        }
      }
    }
  }

  /** Is there something to stand on just ahead of the entity's front foot? (Walkers turn at ledges.) */
  groundAhead(e, dir) {
    const c = Math.floor((dir > 0 ? e.pos.x + e.w + 1 : e.pos.x - 1) / T);
    const r = Math.floor((e.pos.y + e.h + 1) / T);
    return this.isSolid(c, r) || this.at(c, r) === '-';
  }

  /** Only the lower half of a spike tile hurts. */
  touchesSpikes(e) {
    const c0 = Math.floor(e.pos.x / T);
    const c1 = Math.floor((e.pos.x + e.w - 0.001) / T);
    const r0 = Math.floor(e.pos.y / T);
    const r1 = Math.floor((e.pos.y + e.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.at(c, r) === '^' && e.pos.y + e.h > r * T + T / 2) return true;
      }
    }
    return false;
  }

  /** Draw only the tiles inside the camera view. */
  render(r) {
    const view = this.scene.camera.view;
    const c0 = Math.max(0, Math.floor(view.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((view.x + view.w) / T));
    const r0 = Math.max(0, Math.floor(view.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((view.y + view.h) / T));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = this.grid[row][col];
        if (t !== '.') this.drawTile(r, t, col * T, row * T);
      }
    }
  }

  drawTile(r, t, x, y) {
    // Placeholder art; replace with sprite-sheet frames per world.
    if (t === '#') r.rect(x, y, T, T, '#8b5a2b');
    else if (t === 'B') r.rect(x, y, T, T, '#d9822b');
    else if (t === '-') r.rect(x, y, T, 4, '#c08a4b');
    else if (t === '^') r.poly([x, y + T, x + 8, y + 7, x + 16, y + T], '#dcdce6');
  }
}
```

### C.2 Player controller

Implements §3.2: acceleration, friction, coyote time, jump buffer, variable jump height and squash and stretch. Wall slide, wall jump, hearts and knockback (§3.4) are added on top.

```js
import { approach, Entity } from '../vendor/h3-engine.min.js';
import { GRAVITY, JUMP, LEFT, MAX_FALL, RIGHT } from './config.js';

const RUN_SPEED = 110;
const ACCEL_GROUND = 1000;
const ACCEL_AIR = 650;
const FRICTION = 1400;
const JUMP_SPEED = 320;
const COYOTE_TIME = 0.08;
const JUMP_BUFFER = 0.12;

export class Player extends Entity {
  constructor(x, y) {
    // 12×14 hitbox inside a 16×16 tile.
    super({ x: x + 2, y: y + 2, w: 12, h: 14, z: 5, tags: ['player'] });
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.facing = 1;
    this.sx = 1; // squash and stretch, eased back to 1
    this.sy = 1;
  }

  update(dt, { input, audio }) {
    const level = this.scene.level;
    const dir = input.axis(LEFT, RIGHT);
    if (dir !== 0) this.facing = dir;
    const accel = dir !== 0 ? (this.onGround ? ACCEL_GROUND : ACCEL_AIR) : this.onGround ? FRICTION : ACCEL_AIR / 2;
    this.vel.x = approach(this.vel.x, dir * RUN_SPEED, accel * dt);

    this.coyote = this.onGround ? COYOTE_TIME : this.coyote - dt;
    this.buffer = input.justPressed(JUMP) ? JUMP_BUFFER : this.buffer - dt;
    if (this.buffer > 0 && this.coyote > 0) {
      this.jump(JUMP_SPEED);
      audio.tone({ freq: 300, to: 600, duration: 0.1, volume: 0.1 });
    }
    // Releasing jump while rising cuts the jump short.
    const cut = this.vel.y < 0 && !input.isDown(JUMP);
    this.vel.y = Math.min(this.vel.y + GRAVITY * (cut ? 2.5 : 1) * dt, MAX_FALL);

    const wasOnGround = this.onGround;
    const landingSpeed = this.vel.y;
    this.onGround = level.moveAndCollide(this, dt).ground;
    if (this.onGround && !wasOnGround && landingSpeed > 150) {
      this.sx = 1.3;
      this.sy = 0.7;
    }
    this.sx = approach(this.sx, 1, dt * 3);
    this.sy = approach(this.sy, 1, dt * 3);
  }

  jump(speed) {
    this.vel.y = -speed;
    this.buffer = 0;
    this.coyote = 0;
    this.onGround = false;
    this.sx = 0.75;
    this.sy = 1.3;
  }

  render(r) {
    // Squash and stretch around the feet. Replace the rect with animation frames.
    const w = Math.round(this.w * this.sx);
    const h = Math.round(this.h * this.sy);
    r.rect(Math.round(this.cx - w / 2), Math.round(this.pos.y + this.h - h), w, h, '#ff5e5b');
  }
}
```

`config.js` holds `GRAVITY = 900`, `MAX_FALL = 420`, and the key arrays from §3.1.

### C.3 Play scene: spawning, camera, stomps

```js
import { Collision, Pool, Scene } from '../vendor/h3-engine.min.js';
import { JUMP } from './config.js';
import { Level } from './Level.js';
import { Player } from './Player.js';

export class PlayScene extends Scene {
  preload(assets) {
    const json = {};
    for (let i = 1; i <= 10; i++) json[`level-${i}`] = `levels/${i}.json`;
    return assets.load({ json }); // keys already loaded are skipped
  }

  enter({ level = 1 } = {}) {
    const def = this.ctx.assets.json(`level-${level}`);
    this.level = this.add(new Level(def.map));
    for (const { ch, x, y } of this.level.spawns) {
      if (ch === 'P') this.player = this.add(new Player(x, y));
      // else: create enemies, coins, flag … by character (§4.1)
    }
    this.camera.follow(this.player, { lerp: 0.15, offsetY: -16 });
    this.camera.setBounds(0, 0, this.level.w, this.level.h);
    this.camera.roundPixels = true;
    this.camera.snap();
  }

  update(_dt, { input }) {
    Collision.check(this, 'player', 'enemy', (p, enemy) => {
      const stomp = p.vel.y > 0 && p.pos.y + p.h - enemy.pos.y < 8 && enemy.has('stompable');
      if (stomp) {
        enemy.destroy();
        p.jump(input.isDown(JUMP) ? 300 : 220); // STOMP_BOUNCE
        this.camera.shake(2, 0.15);
      } else {
        // hurt: -1 heart, knockback, invulnerability (§3.4)
      }
    });
  }
}
```

### C.4 Parallax layer

Repeats a feature every `spacing` pixels on a layer that scrolls at `factor` times the camera speed (0 = fixed to the screen, 1 = moves with the world). Call it from a backdrop entity with a low `z` (e.g. -10).

```js
// Cheap deterministic noise so scenery doesn't change between frames.
const hash = (i) => {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function layer(view, factor, spacing, draw) {
  const offset = view.x * factor;
  const first = Math.floor(offset / spacing) - 2;
  const last = Math.ceil((offset + view.w) / spacing) + 2;
  for (let i = first; i <= last; i++) draw(view.x + i * spacing - offset, i);
}

// In the backdrop's render(r):
const view = this.scene.camera.view;
layer(view, 0.3, 70, (wx, i) => {
  r.circle(Math.round(wx), Math.round(view.y + 190), 40 + hash(i) * 30, '#8fd3a8'); // far hills
});
```

### C.5 Text label with shadow

```js
/** Draw text with a 1px drop shadow so it reads over any background. */
export const label = (r, str, x, y, { size = 8, color = '#fff', align = 'center' } = {}) => {
  const font = `bold ${size}px monospace`;
  r.text(str, x + 1, y + 1, { font, color: 'rgba(0,0,0,0.5)', align });
  r.text(str, x, y, { font, color, align });
};
```

### C.6 Starter sounds

```js
/** Every sound is synthesized, so there are no files to load. */
export const sfx = (audio, kind) => {
  if (kind === 'jump') audio.tone({ freq: 300, to: 600, duration: 0.1, volume: 0.1 });
  else if (kind === 'coin') audio.tone({ freq: 988, to: 1319, duration: 0.08, volume: 0.1 });
  else if (kind === 'stomp') audio.tone({ freq: 220, to: 80, duration: 0.12, volume: 0.15 });
  else if (kind === 'die') audio.tone({ freq: 440, to: 80, duration: 0.6, type: 'sawtooth', volume: 0.15 });
};

/** A rising run of notes for clearing a level. `timer` is `scene.timer`. */
export const fanfare = (timer, audio) => {
  [523, 659, 784, 1047].forEach((freq, i) => {
    timer.after(i * 0.12, () => audio.tone({ freq, duration: 0.15, type: 'triangle' }));
  });
};
```

Chain pitch (§8.4) is a frequency multiplier: `freq * 2 ** (semitones / 12)`.

### C.7 Particles

```js
import { Entity, rand } from '../vendor/h3-engine.min.js';

export class Particle extends Entity {
  constructor() {
    super({ w: 2, h: 2, z: 6, tags: ['fx'] });
    this.debug = false; // keep decoration out of the debug overlay
  }

  spawn(x, y, color, pool, { speed = 80, up = 60, gravity = 300 } = {}) {
    this.pos.set(x, y);
    this.vel.set(rand(-speed, speed), rand(-speed - up, speed - up));
    this.life = this.maxLife = rand(0.3, 0.6);
    this.color = color;
    this.gravity = gravity;
    this.pool = pool;
    return this;
  }

  update(dt) {
    this.vel.y += this.gravity * dt;
    super.update(dt);
    this.life -= dt;
    if (this.life <= 0) {
      this.destroy();
      this.pool.release(this);
    }
  }

  render(r) {
    r.alpha = this.life / this.maxLife;
    r.rect(Math.round(this.pos.x), Math.round(this.pos.y), 2, 2, this.color);
    r.alpha = 1;
  }
}

// In a scene: this.particles = new Pool(() => new Particle(), 60);
// burst: for (let i = 0; i < n; i++) this.add(this.particles.get().spawn(x, y, color, this.particles));
```

### C.8 Level 1 reference map

The prototype's first level (110 columns), the starting point for §5.4 level 1. It doesn't yet include gems, checkpoints or hearts.

```
..............................................................................................................
..............................................................................................................
..............................................................................................................
..............................................................................................................
.........................................................................oooo.................................
.........................................................................----.................................
.............................................................ooooo............................................
....................................ooooo....................................................o................
.............o..............oo......BBBBB................####.......----..........o.........BBB...............
....................BBB.................................#####......................................BB.........
..P..............oo.BBB............e.....e.............######.........e.......e.........e......e...BB....F....
############...############....##############^^^^############.....###############...##########################
############...############....##############################.....###############...##########################
############...############....##############################.....###############...##########################
############...############....##############################.....###############...##########################
```

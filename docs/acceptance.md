# Acceptance checklist (GDD §12)

Status of each per-level item, with the evidence that backs it. "Automated" means a script in this repo checks it; re-run it before each release.

| Item | Status | Evidence |
| --- | --- | --- |
| The first 20 tiles are safe | ✅ Automated | `npm run check-levels` lints every level for enemies and spikes in columns 0–19 |
| No main-path jump exceeds the §3.3 "skill" metrics; no wall jump before level 5 | ✅ Partly automated | Wall jump is off below level 5 (`WALL_JUMP_FROM_LEVEL`), and the checker runs the real controller, so required jumps are physically possible. "Skill vs comfortable" per jump was judged by hand while authoring `tools/build_levels.py` |
| Each of the 3 gems is reachable, has a visible hint, needs no later abilities | ✅ Reachability automated | `check-levels` reaches 26 of 27 gems. Level 2 gem 2 needs a Hopper stomp mid-hop (the checker doesn't model enemies; listed in `checker.enemyGems`). Hints (cracks on fake walls, coins, visible niches) were placed by hand |
| No softlocks | ✅ Partly automated | The checker's search never strands Hop with no way back to the flag. Pits respawn on safe ground; crumble blocks, switch states and thornwater reset when Hop respawns |
| Checkpoints at most 45 s apart at par pace | ⚠️ Needs playtest data | Checkpoint columns follow §5.3. Times come from the playtest telemetry (F9 export + `tools/telemetry-report.mjs`) |
| Every enemy and hazard has a ≥0.4 s telegraph with a sound | ✅ | Hopper squash 0.3 s (as specified in §4.3), Dropper 0.35 s (§4.3), Puffer 0.4 s, boss tells 0.4–0.6 s, rock and goo shadows 0.5–0.6 s, each with its §8.4 sound |
| 60 fps with the debug overlay on; no allocations while running | ✅ Desktop / ⚠️ Mobile | 60 FPS / 60 UPS in headless Chrome (debug overlay). Pools for particles, acorns and spores; reused HUD state. The 2019 mid-range phone target is untested |
| Music loops cleanly; SFX don't clip in dense moments | ✅ Synth / ⚠️ Length | Sequencer loops are sample-accurate on the audio clock; voice limits for coin, stomp and cannon (§8.5). Loops are 5–16 s, shorter than the §8.3 targets |
| Keyboard and touch, 1×–4× scale, Chrome / Firefox / Safari | ✅ Chrome, Firefox / ⚠️ Safari | Smoke tests in headless Chrome; the release build renders and runs in headless Firefox; touch was verified with synthetic multi-touch events. Safari (and iOS) not tested |

## How to re-run the automated checks

```sh
npm test                 # controller metrics (§3.2/§3.3)
npm run check-levels     # flags, gems, first-screen safety, hearts after checkpoints
npm run release          # dist/ build, missing-import check, 6 MB budget (§9.3)
python3 -m http.server 8765 &
node test/run-smoke.mjs 1             # play, pause, clear in headless Chrome
node test/run-smoke.mjs 10 180 '' boss # all three boss phases through to the ending
```

`npm run deploy` runs the first three before publishing to GitHub Pages.

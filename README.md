# Pixel Hop

2D precision platformer on [h3-engine](https://github.com/mahmoudalnkeeb/h3-engine) v0.2.0 (vendored in `vendor/`). Design: `design/pixel-hop-gdd.md`.

## Run

```sh
npm start            # static server on http://localhost:8080
npm test             # headless physics checks against GDD §3.2/§3.3
```

Dev URLs: `?level=1`, `?level=2`, `?level=10` (boss), `?level=sandbox` (every ability in one level), `&debug` (overlay, toggle with `` ` ``; exposes `window.game` and unlocks every built level on the map).

Browser smoke tests (need Chrome and a server on :8765, e.g. `python3 -m http.server 8765`):

```sh
node test/run-smoke.mjs 1             # run right through level 1, pause, clear
node test/run-smoke.mjs 10 60 '' boss # scripted King Gloop phase 1
```

Levels 2 and 10 are generated: edit `tools/build_levels.py`, then `python3 tools/build_levels.py`.

## Layout

| Path | What |
| --- | --- |
| `src/config.js` | Every tunable constant and key binding. Tune only here. |
| `src/world/Level.js` | ASCII map loader, tile collision, one-way + moving-platform landings |
| `src/entities/Player.js` | Hop: run, variable jump, coyote, buffer, stomp, drop-through, wall slide/jump, hearts |
| `src/entities/KingGloop.js` | Boss phase 1 (§6.3) and shockwaves |
| `src/scenes/` | title, select (world map), play, pause, options, clear |
| `src/art/` | Pixel art painted into sprite sheets at startup (characters, per-world tiles, boss) |
| `src/audio/` | Music/SFX/UI buses with ducking (`Mixer`), chiptune sequencer (`Jukebox`), score (`songs.js`) |
| `levels/*.json` | Levels in the GDD §4.1 format; add new ids to `BUILT_LEVELS` in config |

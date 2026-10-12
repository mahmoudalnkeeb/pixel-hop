# Pixel Hop

2D precision platformer on [h3-engine](https://github.com/mahmoudalnkeeb/h3-engine) v0.2.0 (vendored in `vendor/`). Design: `design/pixel-hop-gdd.md`.

## Run

```sh
npm start            # static server on http://localhost:8080
npm test             # headless physics checks against GDD §3.2/§3.3
```

Dev URLs: `?level=1`, `?level=sandbox` (every ability in one level), `&debug` (overlay, toggle with `` ` ``; also exposes `window.game`).

Browser smoke test (needs Chrome and a server on :8765, e.g. `python3 -m http.server 8765`): `node test/run-smoke.mjs 1`.

## Layout

| Path | What |
| --- | --- |
| `src/config.js` | Every tunable constant and key binding. Tune only here. |
| `src/world/Level.js` | ASCII map loader, tile collision, one-way + moving-platform landings |
| `src/entities/Player.js` | Hop: run, variable jump, coyote, buffer, stomp, drop-through, wall slide/jump, hearts |
| `src/scenes/` | title, play, pause, clear |
| `levels/*.json` | Levels in the GDD §4.1 format; add new ids to `LEVELS` in config |

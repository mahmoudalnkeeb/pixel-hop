import { Game } from '../vendor/h3-engine.min.js';
import { Jukebox } from './audio/Jukebox.js';
import { Mixer } from './audio/Mixer.js';
import { BUILT_LEVELS, EXTRA_LEVELS, WORLDS } from './config.js';
import { loadSave } from './save.js';
import { AssistScene } from './scenes/AssistScene.js';
import { BossIntroScene } from './scenes/BossIntroScene.js';
import { ClearScene } from './scenes/ClearScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';
import { AssistOptionsScene, OptionsScene } from './scenes/OptionsScene.js';
import { applyKeys } from './input/controls.js';
import { TouchControls } from './input/TouchControls.js';
import { PauseScene } from './scenes/PauseScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { SelectScene } from './scenes/SelectScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { initSfx } from './sfx.js';
import { followWindow, initialViewSize } from './view.js';
import { exportTelemetry } from './telemetry.js';

// Dev shortcuts: ?level=1 or ?level=sandbox skips the title; ?debug opens the overlay (toggle with `)
// and unlocks every built level on the map.
const params = new URLSearchParams(location.search);
const level = params.get('level');

const view = initialViewSize();
const game = new Game({
  canvas: '#game',
  width: view.w,
  height: view.h,
  scale: 'fit', // src/view.js picks a view size that makes 'fit' fill the window
  background: WORLDS[1].sky,
  debug: params.has('debug'),
});
game.devUnlock = params.has('debug');
if (params.has('debug')) {
  window.game = game; // console access while developing
  // F9 downloads the playtest telemetry (§11).
  window.addEventListener('keydown', (e) => e.code === 'F9' && exportTelemetry());
}

// Audio buses and music live for the whole session.
game.mixer = new Mixer(game.audio);
game.jukebox = new Jukebox(game.mixer);
initSfx(game.mixer);
const { options } = loadSave();
for (const bus of ['music', 'sfx', 'ui']) game.mixer.setLevel(bus, options[bus]);
applyKeys(options.keys);

followWindow(game);

// On-screen touch controls draw on top of every scene; menus read taps from `game.touch`.
const touch = new TouchControls(game);
game.touch = touch;
game.overlay = (r) => touch.render(r);

game.scenes
  .add('title', TitleScene)
  .add('select', SelectScene)
  .add('play', PlayScene)
  .add('pause', PauseScene)
  .add('options', OptionsScene)
  .add('assist_options', AssistOptionsScene)
  .add('controls', ControlsScene)
  .add('clear', ClearScene)
  .add('boss_intro', BossIntroScene)
  .add('assist', AssistScene)
  .add('ending', EndingScene);

if (level && [...BUILT_LEVELS, ...EXTRA_LEVELS].includes(level)) game.start('play', { level });
else game.start('title');

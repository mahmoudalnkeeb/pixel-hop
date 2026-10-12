import { Game } from '../vendor/h3-engine.min.js';
import { Jukebox } from './audio/Jukebox.js';
import { Mixer } from './audio/Mixer.js';
import { BUILT_LEVELS, EXTRA_LEVELS, VIEW_H, VIEW_W, WORLDS } from './config.js';
import { loadSave } from './save.js';
import { ClearScene } from './scenes/ClearScene.js';
import { OptionsScene } from './scenes/OptionsScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { SelectScene } from './scenes/SelectScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { initSfx } from './sfx.js';

// Dev shortcuts: ?level=1 or ?level=sandbox skips the title; ?debug opens the overlay (toggle with `)
// and unlocks every built level on the map.
const params = new URLSearchParams(location.search);
const level = params.get('level');

const game = new Game({
  canvas: '#game',
  width: VIEW_W,
  height: VIEW_H,
  scale: 'pixel',
  background: WORLDS[1].sky,
  debug: params.has('debug'),
});
game.devUnlock = params.has('debug');
if (params.has('debug')) window.game = game; // console access while developing

// Audio buses and music live for the whole session.
game.mixer = new Mixer(game.audio);
game.jukebox = new Jukebox(game.mixer);
initSfx(game.mixer);
const { options } = loadSave();
for (const bus of ['music', 'sfx', 'ui']) game.mixer.setLevel(bus, options[bus]);

game.scenes
  .add('title', TitleScene)
  .add('select', SelectScene)
  .add('play', PlayScene)
  .add('pause', PauseScene)
  .add('options', OptionsScene)
  .add('clear', ClearScene);

if (level && [...BUILT_LEVELS, ...EXTRA_LEVELS].includes(level)) game.start('play', { level });
else game.start('title');

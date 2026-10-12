import { Game } from '../vendor/h3-engine.min.js';
import { EXTRA_LEVELS, LEVELS, VIEW_H, VIEW_W, WORLDS } from './config.js';
import { ClearScene } from './scenes/ClearScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { TitleScene } from './scenes/TitleScene.js';

// Dev shortcuts: ?level=1 or ?level=sandbox skips the title; ?debug opens the overlay (toggle with `).
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
if (params.has('debug')) window.game = game; // console access while developing

game.scenes.add('title', TitleScene).add('play', PlayScene).add('pause', PauseScene).add('clear', ClearScene);

if (level && [...LEVELS, ...EXTRA_LEVELS].includes(level)) game.start('play', { level });
else game.start('title');

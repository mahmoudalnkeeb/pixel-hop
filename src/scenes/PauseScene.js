import { Scene } from '../../vendor/h3-engine.min.js';
import { PAUSE, VIEW_H, VIEW_W } from '../config.js';
import { sfx } from '../sfx.js';
import { label } from '../ui/label.js';
import { Menu } from '../ui/Menu.js';

/** Pushed over the play scene. Pops with the chosen action, handled by `PlayScene.resume` (§9.1). */
export class PauseScene extends Scene {
  enter() {
    this.menu = new Menu([
      { text: 'Resume', value: 'resume' },
      { text: 'Restart from checkpoint', value: 'checkpoint' },
      { text: 'Restart level', value: 'restart' },
      { text: 'Quit to title', value: 'quit' },
    ]);
  }

  update(_dt, ctx) {
    if (ctx.input.justPressed(PAUSE)) {
      sfx(ctx.audio, 'pause');
      this.game.scenes.pop('resume');
      return;
    }
    const choice = this.menu.update(ctx);
    if (choice) this.game.scenes.pop(choice);
  }

  render(r) {
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.6)');
    label(r, 'PAUSED', VIEW_W / 2, 50, { size: 16 });
    this.menu.render(r, VIEW_W / 2, 84);
  }
}

import { Scene } from '../../vendor/h3-engine.min.js';
import { PAUSE, VIEW_H, VIEW_W } from '../config.js';
import { loadSave } from '../save.js';
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
      { text: 'Options', value: 'options' },
      { text: 'Quit to map', value: 'map' },
    ]);
    // Assist Mode "skip level" (§9.5) appears only when the toggle is on.
    if (loadSave().options.assist?.skip) this.menu.items.splice(3, 0, { text: 'Skip level (Assist)', value: 'skip' });
  }

  update(_dt, ctx) {
    if (ctx.input.justPressed(PAUSE)) {
      sfx('pause');
      this.game.scenes.pop('resume');
      return;
    }
    const choice = this.menu.update(ctx);
    if (choice === 'options') this.game.scenes.push('options');
    else if (choice) this.game.scenes.pop(choice);
  }

  render(r) {
    if (this.game.scenes.current !== this) return; // options is open on top
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.6)');
    label(r, 'PAUSED', VIEW_W / 2, 44, { size: 16 });
    this.menu.render(r, VIEW_W / 2, 76);
  }
}

import { Scene } from '../../vendor/h3-engine.min.js';
import { VIEW_H, VIEW_W } from '../config.js';
import { loadSave, writeSave } from '../save.js';
import { label } from '../ui/label.js';
import { Menu } from '../ui/Menu.js';

/** Offered once after 5 deaths in one boss phase (§6.4). Never forced; nothing is lost by accepting (§9.5). */
export class AssistScene extends Scene {
  enter() {
    this.menu = new Menu([
      { text: 'Turn on Assist (85% speed, 5 hearts)', value: 'yes' },
      { text: 'No thanks', value: 'no' },
    ]);
  }

  update(_dt, ctx) {
    const choice = this.menu.update(ctx);
    if (!choice) return;
    if (choice === 'yes') {
      const save = loadSave();
      save.options.assist = { ...save.options.assist, speed: 0.85, hearts: 5 };
      writeSave(save);
      this.game.scenes.pop('assist');
    } else {
      this.game.scenes.pop('resume');
    }
  }

  render(r) {
    r.rect(0, 0, VIEW_W, VIEW_H, 'rgba(10,10,30,0.8)');
    label(r, 'Tough fight!', VIEW_W / 2, 40, { size: 16, color: '#ffd23f' });
    label(r, 'Assist Mode can slow the game down and give', VIEW_W / 2, 66);
    label(r, 'Hop extra hearts. No medals are lost.', VIEW_W / 2, 78);
    label(r, 'You can change it any time in Options.', VIEW_W / 2, 90, { color: '#aab' });
    this.menu.render(r, VIEW_W / 2, 116);
  }
}

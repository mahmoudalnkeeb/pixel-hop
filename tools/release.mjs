// Release build (GDD §11 M4): copies only what the game needs into dist/ and checks the download budget.
// Usage: node tools/release.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist';
const BUDGET = 6 * 1024 * 1024; // §9.3: total download under 6 MB

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'vendor'), { recursive: true });
cpSync('index.html', join(OUT, 'index.html'));
cpSync('src', join(OUT, 'src'), { recursive: true });
cpSync('levels', join(OUT, 'levels'), { recursive: true });
cpSync('vendor/h3-engine.min.js', join(OUT, 'vendor/h3-engine.min.js'));

// Every relative import in the shipped modules must exist in dist (catches a stray unminified-engine import).
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const missing = [];
for (const file of files(join(OUT, 'src')).filter((f) => f.endsWith('.js'))) {
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
    const target = join(file, '..', spec);
    if (!existsSync(target)) missing.push(`${file} -> ${spec}`);
  }
}
if (missing.length) {
  console.error('missing imports:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const total = files(OUT).reduce((n, f) => n + statSync(f).size, 0);
console.log(`dist/: ${files(OUT).length} files, ${(total / 1024).toFixed(1)} KB (budget ${(BUDGET / 1024 / 1024).toFixed(0)} MB)`);
if (total > BUDGET) {
  console.error('over the download budget (§9.3)');
  process.exit(1);
}

// Summarise exported playtest telemetry (GDD §11): median deaths and time per checkpoint segment.
// Usage: node tools/telemetry-report.mjs pixel-hop-telemetry-*.json
// Flags any segment whose median deaths exceed 8 or median time exceeds 2× its share of par: redesign those.
import { readFileSync } from 'node:fs';

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node tools/telemetry-report.mjs <exported.json> [...]');
  process.exit(1);
}
const runs = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8'))).filter((r) => r.cleared);
const byLevel = new Map();
for (const run of runs) byLevel.set(run.level, [...(byLevel.get(run.level) ?? []), run]);

for (const [level, list] of [...byLevel].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  let par = 0;
  try {
    par = JSON.parse(readFileSync(`levels/${level}.json`, 'utf8')).par ?? 0;
  } catch {
    // level file not found: skip the par comparison
  }
  const segs = Math.max(...list.map((r) => r.segments.length));
  console.log(`level ${level}: ${list.length} cleared runs (par ${par || '-'} s)`);
  for (let i = 0; i < segs; i++) {
    const deaths = median(list.map((r) => r.segments[i]?.deaths ?? 0));
    const time = median(list.map((r) => r.segments[i]?.time ?? 0));
    const share = par ? par / segs : Infinity;
    const flags = [deaths > 8 && 'DEATHS > 8', time > 2 * share && 'TIME > 2x par share'].filter(Boolean);
    console.log(`  segment ${i}: median deaths ${deaths}, median time ${time.toFixed(1)} s ${flags.length ? '<- ' + flags.join(', ') : ''}`);
  }
}

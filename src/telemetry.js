// Playtest telemetry (GDD §11): deaths and time per checkpoint segment, kept in localStorage.
// Export with F9 while the debug overlay URL flag (?debug) is on; summarise with tools/telemetry-report.mjs.

const KEY = 'pixel-hop-telemetry';
const MAX_RUNS = 300;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** One attempt at a level. Segment 0 runs from the start to the first checkpoint, and so on. */
export class Run {
  constructor(level) {
    this.level = level;
    this.segments = [{ deaths: 0, time: 0 }];
  }

  get current() {
    return this.segments[this.segments.length - 1];
  }

  tick(dt) {
    this.current.time += dt;
  }

  death() {
    this.current.deaths++;
  }

  /** A new checkpoint was lit: the next segment starts. */
  checkpoint() {
    this.segments.push({ deaths: 0, time: 0 });
  }

  /** Store the run (cleared or abandoned). */
  finish(cleared, assisted) {
    const runs = read();
    runs.push({
      level: this.level,
      cleared,
      assisted,
      date: new Date().toISOString(),
      segments: this.segments.map((s) => ({ deaths: s.deaths, time: Math.round(s.time * 10) / 10 })),
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
    } catch {
      // storage full or blocked: telemetry is best-effort
    }
  }
}

/** Download every stored run as a JSON file. */
export const exportTelemetry = () => {
  const blob = new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pixel-hop-telemetry-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

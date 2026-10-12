// Versioned save in localStorage under one key (§9.6). Save on level clear, gem pickup and options change; never mid-level otherwise.

const KEY = 'pixel-hop-save';
const VERSION = 1;

const fresh = () => ({
  version: VERSION,
  levels: {},
  unlocked: 1,
  options: { music: 0.6, sfx: 1.0, ui: 0.8, shake: 'on', assist: { speed: 1, hearts: 3, invincible: false }, keys: {} },
  bossBeaten: false,
});

/** Load the save, or a fresh one. A save with an unknown version is backed up and ignored. */
export const loadSave = () => {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return fresh(); // storage blocked (private mode, sandboxed iframe)
  }
  if (!raw) return fresh();
  try {
    const data = JSON.parse(raw);
    if (data?.version === VERSION) return { ...fresh(), ...data };
  } catch {
    // fall through to the backup below
  }
  try {
    localStorage.setItem(`${KEY}-backup-${Date.now()}`, raw);
  } catch {
    // nothing more we can do
  }
  return fresh();
};

export const writeSave = (save) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage full or blocked: progress for this session only
  }
};

/** Per-level record, created on first use. */
export const levelRecord = (save, id) =>
  (save.levels[id] ??= { cleared: false, bestTime: null, gems: [false, false, false], allCoins: false, deaths: 0 });

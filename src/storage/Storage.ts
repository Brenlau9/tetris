import type { Keybinds } from "../input/actions";

const KEYBINDS_KEY = "tetris_keybinds_v1";
const RECORDS_KEY = "tetris_records_v1";
const SETTINGS_KEY = "tetris_settings_v1";

export type Records = {
  sprint40: {
    bestTimeMs: number | null;
    bestDateISO: string | null;
    completedRuns: number;
  };
};

export type Settings = {
  dasMs: number; // delayed auto shift
  arrMs: number; // auto repeat rate (0 = instant after DAS)
  softDropMs: number; // gravity interval while soft drop is held
};

// Defaults requested
export const DEFAULT_SETTINGS: Settings = {
  dasMs: 75,
  arrMs: 0,
  softDropMs: 33, // will be normalized to your engine default if you prefer; see Engine.ts
};

export function loadKeybinds(fallback: Keybinds): Keybinds {
  try {
    const raw = localStorage.getItem(KEYBINDS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Keybinds>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveKeybinds(k: Keybinds) {
  localStorage.setItem(KEYBINDS_KEY, JSON.stringify(k));
}

export function loadRecords(): Records {
  const fallback: Records = {
    sprint40: { bestTimeMs: null, bestDateISO: null, completedRuns: 0 },
  };
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Records;
    return {
      sprint40: {
        bestTimeMs: parsed?.sprint40?.bestTimeMs ?? null,
        bestDateISO: parsed?.sprint40?.bestDateISO ?? null,
        completedRuns: parsed?.sprint40?.completedRuns ?? 0,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveRecords(r: Records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
}

export function clearRecords() {
  localStorage.removeItem(RECORDS_KEY);
}

/* ---------------- Settings ---------------- */

export function loadSettings(fallback: Settings = DEFAULT_SETTINGS): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<Settings>;
    return normalizeSettings({ ...fallback, ...parsed });
  } catch {
    return fallback;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(s)));
}

export function clearSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}

export function normalizeSettings(s: Settings): Settings {
  return {
    dasMs: clampInt(s.dasMs, 0, 500),
    arrMs: clampInt(s.arrMs, 0, 500),
    softDropMs: clampInt(s.softDropMs, 1, 500),
  };
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

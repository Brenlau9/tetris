import type { Keybinds } from "../input/actions";

const KEYBINDS_KEY = "tetris_keybinds_v1";
const RECORDS_KEY = "tetris_records_v1";

export type Records = {
  sprint40: {
    bestTimeMs: number | null;
    bestDateISO: string | null;
    completedRuns: number;
  };
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

import type { ActivePiece, Rotation, Tetromino, Point } from "./types";

/**
 * SRS kick tables for JLSTZ/T and I pieces for 90° rotations.
 * 180°: we use a compact practical kick list (works well, easy to replace).
 * Symmetric I-piece note:
 * - This skeleton uses standard SRS 90° tables.
 * - If you want "SRS+ symmetric I" behavior exactly, we can swap I kicks to the exact table you choose.
 */

type KickKey =
  | "0->1" | "1->2" | "2->3" | "3->0"
  | "1->0" | "2->1" | "3->2" | "0->3";

const JLSTZ_KICKS: Record<KickKey, Point[]> = {
  "0->1": [{x:0,y:0},{x:-1,y:0},{x:-1,y:1},{x:0,y:-2},{x:-1,y:-2}],
  "1->0": [{x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:0,y:2},{x:1,y:2}],
  "1->2": [{x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:0,y:2},{x:1,y:2}],
  "2->1": [{x:0,y:0},{x:-1,y:0},{x:-1,y:1},{x:0,y:-2},{x:-1,y:-2}],
  "2->3": [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:-2},{x:1,y:-2}],
  "3->2": [{x:0,y:0},{x:-1,y:0},{x:-1,y:-1},{x:0,y:2},{x:-1,y:2}],
  "3->0": [{x:0,y:0},{x:-1,y:0},{x:-1,y:-1},{x:0,y:2},{x:-1,y:2}],
  "0->3": [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:-2},{x:1,y:-2}],
};

const I_KICKS: Record<KickKey, Point[]> = {
  "0->1": [{x:0,y:0},{x:-2,y:0},{x:1,y:0},{x:-2,y:-1},{x:1,y:2}],
  "1->0": [{x:0,y:0},{x:2,y:0},{x:-1,y:0},{x:2,y:1},{x:-1,y:-2}],
  "1->2": [{x:0,y:0},{x:-1,y:0},{x:2,y:0},{x:-1,y:2},{x:2,y:-1}],
  "2->1": [{x:0,y:0},{x:1,y:0},{x:-2,y:0},{x:1,y:-2},{x:-2,y:1}],
  "2->3": [{x:0,y:0},{x:2,y:0},{x:-1,y:0},{x:2,y:1},{x:-1,y:-2}],
  "3->2": [{x:0,y:0},{x:-2,y:0},{x:1,y:0},{x:-2,y:-1},{x:1,y:2}],
  "3->0": [{x:0,y:0},{x:1,y:0},{x:-2,y:0},{x:1,y:-2},{x:-2,y:1}],
  "0->3": [{x:0,y:0},{x:-1,y:0},{x:2,y:0},{x:-1,y:2},{x:2,y:-1}],
};

// Pragmatic 180 kick lists (easy to replace with exact SRS+ tables)
const KICKS_180_JLSTZT: Point[] = [
  {x:0,y:0},{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:2,y:0},{x:-2,y:0}
];
const KICKS_180_I: Point[] = [
  {x:0,y:0},{x:1,y:0},{x:-1,y:0},{x:2,y:0},{x:-2,y:0},{x:0,y:1},{x:0,y:-1}
];
const KICKS_180_O: Point[] = [{x:0,y:0}];

export function rotCW(r: Rotation): Rotation { return ((r + 1) % 4) as Rotation; }
export function rotCCW(r: Rotation): Rotation { return ((r + 3) % 4) as Rotation; }
export function rot180(r: Rotation): Rotation { return ((r + 2) % 4) as Rotation; }

export function getKicks(type: Tetromino, from: Rotation, to: Rotation): Point[] {
  const key = `${from}->${to}` as KickKey;
  if (type === "O") return [{x:0,y:0}];
  if (type === "I") return I_KICKS[key] ?? [{x:0,y:0}];
  return JLSTZ_KICKS[key] ?? [{x:0,y:0}];
}

export function getKicks180(type: Tetromino): Point[] {
  if (type === "O") return KICKS_180_O;
  if (type === "I") return KICKS_180_I;
  return KICKS_180_JLSTZT;
}

export function clonePiece(p: ActivePiece): ActivePiece {
  return { ...p };
}

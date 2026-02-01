import { COLS, ROWS } from "./constants";
import type { ActivePiece } from "./types";
import { SHAPES } from "./Pieces";

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 empty, >0 piece color index
export type Grid = Cell[][];

const COLOR_INDEX: Record<string, Cell> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

export class Board {
  grid: Grid;

  constructor() {
    this.grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
  }

  reset() {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) this.grid[y][x] = 0;
  }

  canPlace(piece: ActivePiece): boolean {
    const blocks = SHAPES[piece.type][piece.rot];
    for (const b of blocks) {
      const x = piece.x + b.x;
      const y = piece.y + b.y;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      if (this.grid[y][x] !== 0) return false;
    }
    return true;
  }

  lock(piece: ActivePiece) {
    const blocks = SHAPES[piece.type][piece.rot];
    const v = COLOR_INDEX[piece.type];
    for (const b of blocks) {
      const x = piece.x + b.x;
      const y = piece.y + b.y;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        this.grid[y][x] = v;
      }
    }
  }

  clearLines(): number {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (this.grid[y].every((c) => c !== 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array.from({ length: COLS }, () => 0 as Cell));
        cleared++;
        y++; // recheck same y index after shift
      }
    }
    return cleared;
  }

  // For ghost / hard drop
  dropDistance(piece: ActivePiece): number {
    let d = 0;
    while (true) {
      const test = { ...piece, y: piece.y + d + 1 };
      if (!this.canPlace(test)) return d;
      d++;
    }
  }

  occupiedInSpawnArea(): boolean {
    // If any cells in the top hidden rows are occupied, you're "high" but not necessarily topped out.
    // Top-out is detected by failed spawn placement, which engine handles.
    return false;
  }
}

import type { Tetromino } from "./types";

const ALL: Tetromino[] = ["I", "O", "T", "S", "Z", "J", "L"];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Bag7 {
  private bag: Tetromino[] = [];

  next(): Tetromino {
    if (this.bag.length === 0) {
      this.bag = shuffle([...ALL]);
    }
    return this.bag.shift()!;
  }
}

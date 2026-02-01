export type Tetromino = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rotation = 0 | 1 | 2 | 3;

export type Point = { x: number; y: number };

export type ActivePiece = {
  type: Tetromino;
  rot: Rotation;
  x: number; // top-left of 4x4 bounding box in board coords
  y: number;
};

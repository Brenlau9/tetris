export type Action =
  | "moveLeft"
  | "moveRight"
  | "softDrop"
  | "hardDrop"
  | "rotateCW"
  | "rotateCCW"
  | "rotate180"
  | "hold"
  | "restart";

export type Keybinds = Record<Action, string>; // uses KeyboardEvent.code

export const ACTION_LABEL: Record<Action, string> = {
  moveLeft: "Move Left",
  moveRight: "Move Right",
  softDrop: "Soft Drop",
  hardDrop: "Hard Drop",
  rotateCW: "Rotate CW (90°)",
  rotateCCW: "Rotate CCW (90°)",
  rotate180: "Rotate 180°",
  hold: "Hold",
  restart: "Restart Run",
};

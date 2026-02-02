import { Bag7 } from "./Bag7";
import { Board } from "./Board";
import {
  COUNTDOWN_SECONDS,
  GRAVITY_MS,
  LINES_TARGET,
  LOCK_DELAY_MS,
  SOFT_DROP_MS,
} from "./constants";
import type { ActivePiece, Rotation, Tetromino } from "./types";
import { getKicks, getKicks180, rot180, rotCCW, rotCW } from "./Rotation";

export type EngineState = "countdown" | "playing" | "finished";

export type EngineEvents = {
  onFinish: (timeMs: number) => void;
  onTopOut: () => void; // send user to start screen
  onTick?: () => void;
};

export class Engine {
  board = new Board();
  bag = new Bag7();

  state: EngineState = "countdown";

  linesCleared = 0;
  timeMs = 0;

  // countdown
  countdownLeft = COUNTDOWN_SECONDS;
  private countdownAcc = 0;

  // piece & queue
  active!: ActivePiece;
  hold: Tetromino | null = null;
  holdUsedThisTurn = false;

  // NEW: visible queue (next 5)
  queue: Tetromino[] = [];

  // timing
  private fallAcc = 0;
  private lockAcc = 0;
  private softDropDown = false;

  private events: EngineEvents;

  constructor(events: EngineEvents) {
    this.events = events;
  }

  startNewRun() {
    this.board.reset();
    this.bag = new Bag7();

    this.linesCleared = 0;
    this.timeMs = 0;

    this.state = "countdown";
    this.countdownLeft = COUNTDOWN_SECONDS;
    this.countdownAcc = 0;

    this.hold = null;
    this.holdUsedThisTurn = false;

    this.softDropDown = false;

    // Initialize visible queue (next 5)
    this.queue = [];
    while (this.queue.length < 5) this.queue.push(this.bag.next());

    // Spawn first piece (countdown shows board + piece, but no input/gravity)
    this.spawn();
  }

  setSoftDrop(isDown: boolean) {
    this.softDropDown = isDown;
  }

  update(dtMs: number) {
    if (this.state === "countdown") {
      this.countdownAcc += dtMs;
      while (this.countdownAcc >= 1000) {
        this.countdownAcc -= 1000;
        this.countdownLeft -= 1;
        if (this.countdownLeft <= 0) {
          this.state = "playing";
          this.fallAcc = 0;
          this.lockAcc = 0;
          break;
        }
      }
      this.events.onTick?.();
      return;
    }

    if (this.state !== "playing") return;

    this.timeMs += dtMs;

    const fallInterval = this.softDropDown ? SOFT_DROP_MS : GRAVITY_MS;
    this.fallAcc += dtMs;

    while (this.fallAcc >= fallInterval) {
      this.fallAcc -= fallInterval;
      if (!this.tryMove(0, 1)) {
        // on ground: lock delay accumulates
        break;
      }
    }

    // Lock delay logic
    const onGround = !this.board.canPlace({ ...this.active, y: this.active.y + 1 });
    if (onGround) {
      this.lockAcc += dtMs;
      if (this.lockAcc >= LOCK_DELAY_MS) {
        this.lockPiece();
      }
    } else {
      this.lockAcc = 0;
    }

    this.events.onTick?.();
  }

  // -------- actions --------
  moveLeft() {
    this.tryMove(-1, 0);
  }
  moveRight() {
    this.tryMove(1, 0);
  }

  hardDrop() {
    if (this.state !== "playing") return;
    const d = this.board.dropDistance(this.active);
    this.active.y += d;
    this.lockPiece(true);
  }

  rotateCW() {
    this.tryRotate(rotCW(this.active.rot));
  }
  rotateCCW() {
    this.tryRotate(rotCCW(this.active.rot));
  }
  rotate180() {
    this.tryRotate180();
  }

  holdPiece() {
    if (this.state !== "playing") return;
    if (this.holdUsedThisTurn) return;

    this.holdUsedThisTurn = true;
    const current = this.active.type;

    if (this.hold === null) {
      this.hold = current;
      this.spawn();
    } else {
      const swap = this.hold;
      this.hold = current;
      this.spawn(swap);
    }
  }

  restart() {
    this.startNewRun();
  }

  // -------- internals --------
  private spawn(forcedType?: Tetromino) {
    // Pull from visible queue unless forced (hold swap)
    const type = forcedType ?? this.queue.shift()!;
    while (this.queue.length < 5) this.queue.push(this.bag.next());

    const piece: ActivePiece = {
      type,
      rot: 0 as Rotation,
      x: 3,
      y: 0,
    };

    this.active = piece;
    this.holdUsedThisTurn = false;
    this.lockAcc = 0;

    // Top-out: failed spawn placement -> go to start screen
    if (!this.board.canPlace(this.active)) {
      this.state = "finished";
      this.events.onTopOut();
    }
  }

  private tryMove(dx: number, dy: number): boolean {
    if (this.state !== "playing") return false;

    const test = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (this.board.canPlace(test)) {
      this.active = test;
      // movement resets lock delay
      this.lockAcc = 0;
      return true;
    }
    return false;
  }

  private tryRotate(to: Rotation) {
    if (this.state !== "playing") return;

    const from = this.active.rot;
    const kicks = getKicks(this.active.type, from, to);

    for (const k of kicks) {
      const test = {
        ...this.active,
        rot: to,
        x: this.active.x + k.x,
        y: this.active.y - k.y, // board y grows downward
      };
      if (this.board.canPlace(test)) {
        this.active = test;
        this.lockAcc = 0;
        return;
      }
    }
  }

  private tryRotate180() {
    if (this.state !== "playing") return;

    const to = rot180(this.active.rot);
    const kicks = getKicks180(this.active.type);

    for (const k of kicks) {
      const test = {
        ...this.active,
        rot: to,
        x: this.active.x + k.x,
        y: this.active.y - k.y,
      };
      if (this.board.canPlace(test)) {
        this.active = test;
        this.lockAcc = 0;
        return;
      }
    }
  }

  private lockPiece(fromHardDrop = false) {
    if (this.state !== "playing") return;

    this.board.lock(this.active);

    const cleared = this.board.clearLines();
    if (cleared > 0) this.linesCleared += cleared;

    if (this.linesCleared >= LINES_TARGET) {
      this.state = "finished";
      this.events.onFinish(this.timeMs);
      return;
    }

    this.spawn();
    this.lockAcc = 0;
    this.fallAcc = 0;

    void fromHardDrop;
  }

  getLinesRemaining() {
    return Math.max(0, LINES_TARGET - this.linesCleared);
  }
}

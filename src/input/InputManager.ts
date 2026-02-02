import type { Action, Keybinds } from "./actions";
import { ARR_MS, DAS_MS } from "../game/constants";

type Handlers = Partial<Record<Action, () => void>>;
type HeldHandlers = Partial<Record<Action, (isDown: boolean) => void>>;

type RepeatDir = "left" | "right" | null;

export class InputManager {
  private keybinds: Keybinds;
  private enabled = true;

  private down = new Set<string>(); // codes currently down
  private handlers: Handlers = {};
  private heldHandlers: HeldHandlers = {};

  // --- DAS/ARR state ---
  private repeatDir: RepeatDir = null;
  private dasAcc = 0;
  private arrAcc = 0;
  private repeating = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;

    const code = e.code;

    // Stop browser scrolling while playing (arrows/space).
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(code)) {
      e.preventDefault();
    }

    if (this.down.has(code)) return; // edge-trigger only (avoid OS repeat)
    this.down.add(code);

    const action = this.codeToAction(code);
    if (!action) return;

    // Horizontal movement: start DAS/ARR tracking and do the immediate step.
    if (action === "moveLeft") {
      this.startHorizontal("left");
      this.handlers.moveLeft?.(); // immediate move
      return;
    }
    if (action === "moveRight") {
      this.startHorizontal("right");
      this.handlers.moveRight?.(); // immediate move
      return;
    }

    // Other actions are normal edge-trigger.
    this.handlers[action]?.();
    this.heldHandlers[action]?.(true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.down.delete(code);

    const action = this.codeToAction(code);
    if (!action) return;

    // Release held handler (softDrop, etc.)
    this.heldHandlers[action]?.(false);

    // If releasing a horizontal key, decide whether to continue repeating in the other direction.
    if (action === "moveLeft" || action === "moveRight") {
      const leftDown = this.isActionDown("moveLeft");
      const rightDown = this.isActionDown("moveRight");

      if (leftDown && !rightDown) {
        this.startHorizontal("left");
        this.handlers.moveLeft?.(); // optional: immediate shift on direction switch
      } else if (rightDown && !leftDown) {
        this.startHorizontal("right");
        this.handlers.moveRight?.();
      } else {
        this.resetHorizontal();
      }
    }
  };

  constructor(keybinds: Keybinds) {
    this.keybinds = keybinds;
  }

  mount() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
  }

  unmount() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.down.clear();
    this.resetHorizontal();
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;

    if (!enabled) {
      // Release any held actions cleanly
      for (const code of this.down) {
        const a = this.codeToAction(code);
        if (a) this.heldHandlers[a]?.(false);
      }
      this.down.clear();
      this.resetHorizontal();
    }
  }

  setKeybinds(k: Keybinds) {
    this.keybinds = k;
  }

  bindHandlers(h: Handlers) {
    this.handlers = h;
  }

  bindHeldHandlers(h: HeldHandlers) {
    this.heldHandlers = h;
  }

  /** Call once per frame to advance DAS/ARR timers. */
  update(dtMs: number) {
    if (!this.enabled) return;

    // If no current direction, nothing to do.
    if (!this.repeatDir) return;

    // Ensure the chosen direction is still held down.
    const wantAction: Action = this.repeatDir === "left" ? "moveLeft" : "moveRight";
    if (!this.isActionDown(wantAction)) {
      // Let keyup logic handle switching; just reset.
      this.resetHorizontal();
      return;
    }

    // Accumulate DAS.
    this.dasAcc += dtMs;

    if (!this.repeating) {
      if (this.dasAcc < DAS_MS) return;

      this.repeating = true;
      this.arrAcc = 0;

      // ARR=0 means “instant” after DAS.
      if (ARR_MS === 0) {
        this.repeatToWall();
        return;
      }
    }

    if (ARR_MS === 0) return;

    this.arrAcc += dtMs;
    while (this.arrAcc >= ARR_MS) {
      this.arrAcc -= ARR_MS;
      this.stepRepeatOnce();
    }
  }

  private startHorizontal(dir: RepeatDir) {
    // Switching directions should reset DAS/ARR timing.
    if (this.repeatDir !== dir) {
      this.repeatDir = dir;
      this.dasAcc = 0;
      this.arrAcc = 0;
      this.repeating = false;
    }
  }

  private resetHorizontal() {
    this.repeatDir = null;
    this.dasAcc = 0;
    this.arrAcc = 0;
    this.repeating = false;
  }

  private stepRepeatOnce() {
    if (this.repeatDir === "left") this.handlers.moveLeft?.();
    else if (this.repeatDir === "right") this.handlers.moveRight?.();
  }

  private repeatToWall() {
    // We don’t have a boolean “moved” return, so use a safe cap.
    // Board is 10 wide; 40 is plenty.
    for (let i = 0; i < 40; i++) this.stepRepeatOnce();
  }

  private isActionDown(action: Action): boolean {
    const code = this.keybinds[action];
    return this.down.has(code);
  }

  private codeToAction(code: string): Action | null {
    const entries = Object.entries(this.keybinds) as [Action, string][];
    for (const [action, bound] of entries) {
      if (bound === code) return action;
    }
    return null;
  }
}

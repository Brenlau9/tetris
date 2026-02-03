import type { Action, Keybinds } from "./actions";

type Handlers = Partial<Record<Action, () => void>>;
type HeldHandlers = Partial<Record<Action, (isDown: boolean) => void>>;

type RepeatDir = "left" | "right" | null;

export class InputManager {
  private keybinds: Keybinds;
  private enabled = true;

  private down = new Set<string>(); // codes currently down
  private handlers: Handlers = {};
  private heldHandlers: HeldHandlers = {};

  // ---- Tuning (runtime configurable) ----
  private dasMs = 75;
  private arrMs = 0;

  // ---- DAS/ARR state ----
  private repeatDir: RepeatDir = null;
  private dasAcc = 0;
  private arrAcc = 0;
  private repeating = false;

  constructor(keybinds: Keybinds) {
    this.keybinds = keybinds;
  }

  setTuning(opts: { dasMs: number; arrMs: number }) {
    this.dasMs = Math.max(0, Math.floor(Number(opts.dasMs)));
    this.arrMs = Math.max(0, Math.floor(Number(opts.arrMs)));
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
    this.enabled = enabled;
    if (!enabled) {
      // Release held actions cleanly
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

  /** Call once per frame from GameScreen loop. */
  update(dtMs: number) {
    if (!this.enabled) return;

    // Held actions (soft drop)
    const soft = this.keybinds.softDrop;
    this.heldHandlers.softDrop?.(this.down.has(soft));

    // Horizontal DAS/ARR repeat
    this.updateHorizontalRepeat(dtMs);
  }

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

    // Horizontal movement special-cased for DAS/ARR
    if (action === "moveLeft") {
      this.startHorizontal("left");
      this.handlers.moveLeft?.(); // immediate step
      return;
    }
    if (action === "moveRight") {
      this.startHorizontal("right");
      this.handlers.moveRight?.(); // immediate step
      return;
    }

    // Other actions: fire once on press
    this.handlers[action]?.();
    this.heldHandlers[action]?.(true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.down.delete(code);

    const action = this.codeToAction(code);
    if (!action) return;

    // Release held handler
    this.heldHandlers[action]?.(false);

    // Horizontal key release: if other dir still held, switch; else stop repeating.
    if (action === "moveLeft" || action === "moveRight") {
      const leftDown = this.isActionDown("moveLeft");
      const rightDown = this.isActionDown("moveRight");

      if (leftDown && !rightDown) {
        this.startHorizontal("left");
        this.handlers.moveLeft?.(); // optional immediate step on switch
      } else if (rightDown && !leftDown) {
        this.startHorizontal("right");
        this.handlers.moveRight?.();
      } else {
        this.resetHorizontal();
      }
    }
  };

  private updateHorizontalRepeat(dtMs: number) {
    if (!this.repeatDir) return;

    const wantAction: Action = this.repeatDir === "left" ? "moveLeft" : "moveRight";
    if (!this.isActionDown(wantAction)) {
      this.resetHorizontal();
      return;
    }

    this.dasAcc += dtMs;

    if (!this.repeating) {
      if (this.dasAcc < this.dasMs) return;

      this.repeating = true;
      this.arrAcc = 0;

      // ARR=0: instant to wall after DAS
      if (this.arrMs === 0) {
        this.repeatToWall();
        return;
      }
    }

    if (this.arrMs === 0) return;

    this.arrAcc += dtMs;
    while (this.arrAcc >= this.arrMs) {
      this.arrAcc -= this.arrMs;
      this.stepRepeatOnce();
    }
  }

  private startHorizontal(dir: RepeatDir) {
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
    // Safe cap; board width is 10 so this is plenty.
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

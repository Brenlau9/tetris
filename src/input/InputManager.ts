import type { Action, Keybinds } from "./actions";

type Handlers = Partial<Record<Action, () => void>>;
type HeldHandlers = Partial<Record<Action, (isDown: boolean) => void>>;

export class InputManager {
  private keybinds: Keybinds;
  private enabled = true;

  private down = new Set<string>(); // codes currently down
  private handlers: Handlers = {};
  private heldHandlers: HeldHandlers = {};

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

    this.handlers[action]?.();
    this.heldHandlers[action]?.(true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.down.delete(code);

    const action = this.codeToAction(code);
    if (!action) return;

    this.heldHandlers[action]?.(false);
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
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.down.clear();
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

  private codeToAction(code: string): Action | null {
    const entries = Object.entries(this.keybinds) as [Action, string][];
    for (const [action, bound] of entries) {
      if (bound === code) return action;
    }
    return null;
  }
}

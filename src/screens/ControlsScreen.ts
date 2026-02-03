import type { Router, Screen } from "../router/Router";
import { ACTION_LABEL} from "../input/actions";
import type { Action, Keybinds } from "../input/actions";
import { DEFAULT_KEYBINDS } from "../input/defaultKeybinds";
import { loadKeybinds, saveKeybinds } from "../storage/Storage";

export class ControlsScreen implements Screen {
  private root!: HTMLDivElement;
  private keybinds: Keybinds = loadKeybinds(DEFAULT_KEYBINDS);

  private listeningFor: Action | null = null;
  
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  mount(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "card";
    this.render();
    container.appendChild(this.root);

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
  }

  unmount() {
    window.removeEventListener("keydown", this.onKeyDown);
    this.root?.remove();
  }

  private render() {
    const rows = (Object.keys(this.keybinds) as Action[])
      .map((a) => {
        const label = ACTION_LABEL[a];
        const value = this.keybinds[a];
        const listening = this.listeningFor === a ? ` <span class="muted">(press a key…)</span>` : "";
        return `
          <div class="row" style="justify-content: space-between; border-top: 1px solid #f0f0f0; padding: 10px 0;">
            <div><strong>${label}</strong>${listening}</div>
            <div class="row">
              <code>${value}</code>
              <button class="btn" data-rebind="${a}">Rebind</button>
            </div>
          </div>
        `;
      })
      .join("");

    this.root.innerHTML = `
      <h1 class="h1">Controls</h1>

      <div style="margin-top: 14px;">
        ${rows}
      </div>

      <div style="height: 16px"></div>
      <div class="row">
        <button class="btn" data-action="reset">Reset to Defaults</button>
        <button class="btn primary" data-action="back">Back</button>
      </div>

      <div style="height: 10px"></div>
      <div class="small">Bindings use <code>KeyboardEvent.code</code> (layout-stable). Duplicates are not allowed.</div>
    `;

    this.root.onclick = (e) => {
      const t = e.target as HTMLElement;
      const rebind = t.getAttribute("data-rebind") as Action | null;
      const action = t.getAttribute("data-action");

      if (rebind) {
        this.listeningFor = rebind;
        this.render();
        return;
      }

      if (action === "reset") {
        this.keybinds = { ...DEFAULT_KEYBINDS };
        saveKeybinds(this.keybinds);
        this.listeningFor = null;
        this.render();
        return;
      }

      if (action === "back") {
        this.router.go("start");
      }
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.listeningFor) return;

    e.preventDefault();

    const code = e.code;

    // Disallow duplicates
    const used = new Set(Object.values(this.keybinds));
    used.delete(this.keybinds[this.listeningFor]);
    if (used.has(code)) {
      // simple feedback
      this.flash(`Key ${code} is already bound.`);
      return;
    }

    this.keybinds[this.listeningFor] = code;
    saveKeybinds(this.keybinds);
    this.listeningFor = null;
    this.render();
  };

  private flash(msg: string) {
    const prev = this.root.querySelector(".small");
    if (!prev) return;
    const old = prev.textContent ?? "";
    prev.textContent = msg;
    setTimeout(() => (prev.textContent = old), 1200);
  }
}

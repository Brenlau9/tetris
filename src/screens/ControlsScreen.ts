import type { Router, Screen } from "../router/Router";
import { ACTION_LABEL } from "../input/actions";
import type { Action, Keybinds } from "../input/actions";
import { DEFAULT_KEYBINDS } from "../input/defaultKeybinds";

import {
  DEFAULT_SETTINGS,
  loadKeybinds,
  loadSettings,
  saveKeybinds,
  saveSettings,
  type Settings,
} from "../storage/Storage";

export class ControlsScreen implements Screen {
  private root!: HTMLDivElement;

  private keybinds: Keybinds = loadKeybinds(DEFAULT_KEYBINDS);
  private settings: Settings = loadSettings(DEFAULT_SETTINGS);

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
        const listening =
          this.listeningFor === a ? ` <span class="muted">(press a key…)</span>` : "";
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

      <div style="height: 18px"></div>
      <h2 class="h2">Tuning</h2>
      <div class="small muted" style="margin-top: 6px;">
        DAS/ARR affect horizontal auto-shift. ARR = 0 means “instant” after DAS.
        Soft drop is the gravity interval while holding Soft Drop (smaller = faster).
      </div>

      <div style="height: 10px"></div>

      <div class="box" style="padding: 12px;">
        <div class="row" style="justify-content: space-between;">
          <div><strong>DAS (ms)</strong></div>
          <div class="row" style="gap: 10px;">
            <input id="das" type="number" min="0" max="500" step="1" value="${this.settings.dasMs}" style="width: 110px;" />
            <span class="muted small">${this.settings.dasMs} ms</span>
          </div>
        </div>

        <div style="height: 10px"></div>

        <div class="row" style="justify-content: space-between;">
          <div><strong>ARR (ms)</strong></div>
          <div class="row" style="gap: 10px;">
            <input id="arr" type="number" min="0" max="500" step="1" value="${this.settings.arrMs}" style="width: 110px;" />
            <span class="muted small">${this.settings.arrMs === 0 ? "Instant" : `${this.settings.arrMs} ms`}</span>
          </div>
        </div>

        <div style="height: 10px"></div>

        <div class="row" style="justify-content: space-between;">
          <div><strong>Soft Drop (ms)</strong></div>
          <div class="row" style="gap: 10px;">
            <input id="soft" type="number" min="1" max="500" step="1" value="${this.settings.softDropMs}" style="width: 110px;" />
            <span class="muted small">${this.settings.softDropMs} ms</span>
          </div>
        </div>

        <div style="height: 12px"></div>
        <div class="row">
          <button class="btn" data-action="reset-tuning">Reset Tuning</button>
        </div>
      </div>

      <div style="height: 16px"></div>
      <div class="row">
        <button class="btn" data-action="reset">Reset Keybinds</button>
        <button class="btn primary" data-action="back">Back</button>
      </div>

      <div style="height: 10px"></div>
      <div class="small">Bindings use <code>KeyboardEvent.code</code> (layout-stable). Duplicates are not allowed.</div>
    `;

    // click handling
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

      if (action === "reset-tuning") {
        this.settings = { ...DEFAULT_SETTINGS };
        saveSettings(this.settings);
        this.render();
        return;
      }

      if (action === "back") {
        this.router.go("start");
      }
    };

    // input listeners (numbers)
    const dasEl = this.root.querySelector<HTMLInputElement>("#das")!;
    const arrEl = this.root.querySelector<HTMLInputElement>("#arr")!;
    const softEl = this.root.querySelector<HTMLInputElement>("#soft")!;

    const onTuningChange = () => {
      this.settings = {
        dasMs: toInt(dasEl.value, DEFAULT_SETTINGS.dasMs),
        arrMs: toInt(arrEl.value, DEFAULT_SETTINGS.arrMs),
        softDropMs: toInt(softEl.value, DEFAULT_SETTINGS.softDropMs),
      };
      saveSettings(this.settings);
      // re-render to refresh the labels ("Instant", etc.)
      this.render();
    };

    dasEl.addEventListener("change", onTuningChange);
    arrEl.addEventListener("change", onTuningChange);
    softEl.addEventListener("change", onTuningChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.listeningFor) return;

    e.preventDefault();

    const code = e.code;

    // Disallow duplicates
    const used = new Set(Object.values(this.keybinds));
    used.delete(this.keybinds[this.listeningFor]);
    if (used.has(code)) {
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

function toInt(raw: string, fallback: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

import type { Router, Screen } from "../router/Router";
import { loadRecords } from "../storage/Storage";

export class StartScreen implements Screen {
  private root!: HTMLDivElement;
  
  private router: Router;
  constructor(router: Router) {
    this.router = router;
  }

  mount(container: HTMLElement) {
    const records = loadRecords();

    this.root = document.createElement("div");
    this.root.className = "card";

    const best = records.sprint40.bestTimeMs;
    const bestText = best === null ? "—" : formatMs(best);

    this.root.innerHTML = `
      <h1 class="h1">Minimalist Tetris</h1>
      <div class="muted">40 Lines · 7-bag · Hold · 180 · Lock delay · SRS/SRS+</div>
      <div class="kv">
        <div>Best 40L</div><div><code>${bestText}</code></div>
      </div>
      <div style="height: 16px"></div>
      <div class="row">
        <button class="btn primary" data-action="play">Play</button>
        <button class="btn" data-action="controls">Controls</button>
        <button class="btn" data-action="records">Records</button>
      </div>
      <div style="height: 10px"></div>
      <div class="small">Tip: Rotate CW = X, CCW = Z, 180 = Left Shift, Hold = C</div>
    `;

    this.root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const action = t.getAttribute("data-action");
      if (!action) return;
      if (action === "play") this.router.go("game");
      if (action === "controls") this.router.go("controls");
      if (action === "records") this.router.go("records");
    });

    container.appendChild(this.root);
  }

  unmount() {
    this.root?.remove();
  }
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

import type { Router, Screen } from "../router/Router";
import { clearRecords, loadRecords } from "../storage/Storage";

export class RecordsScreen implements Screen {
  private root!: HTMLDivElement;
  
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  mount(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "card";
    this.render();
    container.appendChild(this.root);
  }

  unmount() {
    this.root?.remove();
  }

  private render() {
    const r = loadRecords();
    const best = r.sprint40.bestTimeMs;
    const bestText = best === null ? "—" : formatMs(best);
    const date = r.sprint40.bestDateISO ?? "—";

    this.root.innerHTML = `
      <h1 class="h1">Records</h1>
      <div class="kv">
        <div>Best 40 Lines</div><div><code>${bestText}</code></div>
        <div>Date</div><div><code>${date}</code></div>
        <div>Completed Runs</div><div><code>${r.sprint40.completedRuns}</code></div>
      </div>

      <div style="height: 16px"></div>
      <div class="row">
        <button class="btn" data-action="clear">Clear Records</button>
        <button class="btn primary" data-action="back">Back</button>
      </div>
    `;

    this.root.onclick = (e) => {
      const t = e.target as HTMLElement;
      const action = t.getAttribute("data-action");
      if (action === "back") this.router.go("start");
      if (action === "clear") {
        if (confirm("Clear all records?")) {
          clearRecords();
          this.render();
        }
      }
    };
  }
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

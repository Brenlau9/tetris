import type { Router, Screen } from "../router/Router";
import { DEFAULT_KEYBINDS } from "../input/defaultKeybinds";
import { loadKeybinds, loadRecords, saveRecords } from "../storage/Storage";
import { InputManager } from "../input/InputManager";
import { Engine } from "../game/Engine";
import { CELL, COLS, HIDDEN_ROWS, ROWS, VISIBLE_ROWS } from "../game/constants";
import { SHAPES } from "../game/Pieces";

export class GameScreen implements Screen {
  private root!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private input!: InputManager;
  private engine!: Engine;

  private raf = 0;
  private last = 0;
  
  private router: Router;
  constructor(router: Router) {
    this.router = router;
  }

  mount(container: HTMLElement) {
    const keybinds = loadKeybinds(DEFAULT_KEYBINDS);

    this.root = document.createElement("div");
    this.root.className = "card";

    this.root.innerHTML = `
      <div class="gameLayout">
        <div class="canvasWrap" style="position: relative;">
          <canvas id="game"></canvas>
          <div class="bigOverlay" id="overlay" style="display:none;"><div></div></div>
        </div>

        <div class="sidebar">
          <div class="box">
            <div><strong>40 Lines</strong></div>
            <div class="muted">Clear 40 lines fast.</div>
            <div style="height: 10px"></div>
            <div class="kv" style="grid-template-columns: 120px 1fr;">
              <div>Time</div><div><code id="time">0.000s</code></div>
              <div>Remaining</div><div><code id="rem">40</code></div>
              <div>Hold</div><div><code id="hold">—</code></div>
            </div>
            <div style="height: 12px"></div>
            <div class="row">
              <button class="btn" id="homeBtn">Home</button>
              <button class="btn" id="restartBtn">Restart</button>
            </div>
            <div style="height: 10px"></div>
            <div class="small">
              CW=<code>KeyX</code> CCW=<code>KeyZ</code> 180=<code>ShiftLeft</code> Hold=<code>KeyC</code>
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(this.root);

    // Canvas setup
    this.canvas = this.root.querySelector<HTMLCanvasElement>("#game")!;
    this.canvas.width = COLS * CELL;
    this.canvas.height = VISIBLE_ROWS * CELL;
    this.ctx = this.canvas.getContext("2d")!;

    const overlay = this.root.querySelector<HTMLDivElement>("#overlay")!;
    const overlayText = overlay.querySelector("div")!;

    // Engine
    this.engine = new Engine({
      onFinish: (timeMs) => {
        // record keeping
        const records = loadRecords();
        records.sprint40.completedRuns += 1;
        const best = records.sprint40.bestTimeMs;
        if (best === null || timeMs < best) {
          records.sprint40.bestTimeMs = timeMs;
          records.sprint40.bestDateISO = new Date().toISOString();
        }
        saveRecords(records);

        // show finish overlay, then user can go home/restart
        overlay.style.display = "grid";
        overlayText.textContent = formatMs(timeMs);
      },
      onTopOut: () => {
        // Spec: topping out sends user to start screen (no game over screen)
        this.router.go("start");
      },
      onTick: () => {
        this.render();
        this.updateHud();
        this.updateOverlay();
      },
    });

    this.engine.startNewRun();

    // Input
    this.input = new InputManager(keybinds);
    this.input.mount();

    // Countdown rule: ignore input until GO
    this.input.setEnabled(false);

    this.input.bindHandlers({
      moveLeft: () => this.engine.moveLeft(),
      moveRight: () => this.engine.moveRight(),
      hardDrop: () => this.engine.hardDrop(),
      rotateCW: () => this.engine.rotateCW(),
      rotateCCW: () => this.engine.rotateCCW(),
      rotate180: () => this.engine.rotate180(),
      hold: () => this.engine.holdPiece(),
      restart: () => this.engine.restart(),
      softDrop: () => {}, // handled as held
    });

    this.input.bindHeldHandlers({
      softDrop: (down) => this.engine.setSoftDrop(down),
    });

    // Buttons
    this.root.querySelector<HTMLButtonElement>("#homeBtn")!.onclick = () => this.router.go("start");
    this.root.querySelector<HTMLButtonElement>("#restartBtn")!.onclick = () => this.engine.restart();

    // Start loop
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    // Initial render
    this.render();
    this.updateHud();
    this.updateOverlay();
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    this.input?.unmount();
    this.root?.remove();
  }

  private loop = (t: number) => {
    const dt = Math.min(50, t - this.last);
    this.last = t;

    // Enable input only once countdown ends (spec)
    const shouldEnable = this.engine.state === "playing" || this.engine.state === "finished";
    this.input.setEnabled(shouldEnable);

    this.engine.update(dt);

    // engine onTick renders; if not, render here as fallback:
    if (!this.engine["events"]?.onTick) {
      this.render();
      this.updateHud();
      this.updateOverlay();
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private updateHud() {
    const timeEl = this.root.querySelector<HTMLSpanElement>("#time")!;
    const remEl = this.root.querySelector<HTMLSpanElement>("#rem")!;
    const holdEl = this.root.querySelector<HTMLSpanElement>("#hold")!;

    timeEl.textContent = formatMs(this.engine.timeMs);
    remEl.textContent = String(this.engine.getLinesRemaining());
    holdEl.textContent = this.engine.hold ?? "—";
  }

  private updateOverlay() {
    const overlay = this.root.querySelector<HTMLDivElement>("#overlay")!;
    const overlayText = overlay.querySelector("div")!;

    if (this.engine.state === "countdown") {
      overlay.style.display = "grid";
      overlayText.textContent = this.engine.countdownLeft > 0 ? String(this.engine.countdownLeft) : "GO";
      return;
    }

    if (this.engine.state === "finished") {
      // if finished by win, overlay already shows time from onFinish
      overlay.style.display = "grid";
      return;
    }

    overlay.style.display = "none";
  }

  private render() {
    const ctx = this.ctx;

    // Background
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw locked cells (visible rows only)
    for (let y = HIDDEN_ROWS; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = this.engine.board.grid[y][x];
        if (cell === 0) continue;
        drawCell(ctx, x, y - HIDDEN_ROWS, cell);
      }
    }

    // Draw active piece (even during countdown)
    const a = this.engine.active;
    if (a) {
      const blocks = SHAPES[a.type][a.rot];
      const colorIndex = pieceColorIndex(a.type);
      for (const b of blocks) {
        const x = a.x + b.x;
        const y = a.y + b.y;
        const vy = y - HIDDEN_ROWS;
        if (vy >= 0 && vy < VISIBLE_ROWS) {
          drawCell(ctx, x, vy, colorIndex);
        }
      }
    }

    // Minimal grid lines (optional): comment out if you want ultra minimal
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, VISIBLE_ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= VISIBLE_ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }
  }
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number) {
  const colors = ["#0000", "#00bcd4", "#ffb300", "#8e24aa", "#43a047", "#e53935", "#1e88e5", "#fb8c00"];
  ctx.fillStyle = colors[colorIndex] ?? "#111";
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
}

function pieceColorIndex(t: string): number {
  return ({ I:1, O:2, T:3, S:4, Z:5, J:6, L:7 } as any)[t] ?? 1;
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

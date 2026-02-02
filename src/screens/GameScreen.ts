import type { Tetromino } from "../game/types";
import { Router, type Screen } from "../router/Router";
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

  private holdCanvas!: HTMLCanvasElement;
  private holdCtx!: CanvasRenderingContext2D;

  private queueCanvas!: HTMLCanvasElement;
  private queueCtx!: CanvasRenderingContext2D;

  private input!: InputManager;
  private engine!: Engine;

  private raf = 0;
  private last = 0;

  constructor(privateRouter: Router) {
    this.router = privateRouter;
  }
  private router: Router;

  mount(container: HTMLElement) {
    const keybinds = loadKeybinds(DEFAULT_KEYBINDS);

    this.root = document.createElement("div");
    this.root.className = "card";

    this.root.innerHTML = `
      <div class="gameLayout">
        <div class="canvasWrap" style="position: relative; padding: 12px;">
          <div class="boardRow">
            <div class="previewBox">
              <div class="previewTitle">Hold</div>
              <canvas id="holdCanvas" class="previewCanvas"></canvas>
            </div>

            <div style="position: relative;">
              <canvas id="game"></canvas>
              <div class="bigOverlay" id="overlay" style="display:none;"><div></div></div>
            </div>

            <div class="previewBox">
              <div class="previewTitle">Next</div>
              <canvas id="queueCanvas" class="previewCanvas"></canvas>
            </div>
          </div>
        </div>

        <div class="sidebar">
          <div class="box">
            <div><strong>40 Lines</strong></div>
            <div class="muted">Clear 40 lines fast.</div>
            <div style="height: 10px"></div>
            <div class="kv" style="grid-template-columns: 120px 1fr;">
              <div>Time</div><div><code id="time">0.000s</code></div>
              <div>Remaining</div><div><code id="rem">40</code></div>
              <div>Hold</div><div><code id="holdText">—</code></div>
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

    const overlay = this.root.querySelector<HTMLDivElement>("#overlay")!;
    const overlayText = overlay.querySelector("div")!;

    // Main canvas setup
    this.canvas = this.root.querySelector<HTMLCanvasElement>("#game")!;
    this.canvas.width = COLS * CELL;
    this.canvas.height = VISIBLE_ROWS * CELL;
    this.ctx = this.canvas.getContext("2d")!;

    // Hold preview canvas (4x4)
    this.holdCanvas = this.root.querySelector<HTMLCanvasElement>("#holdCanvas")!;
    this.holdCanvas.width = 4 * 24;
    this.holdCanvas.height = 4 * 24;
    this.holdCtx = this.holdCanvas.getContext("2d")!;

    // Queue preview canvas (5 x 4x4 stacked with gaps)
    this.queueCanvas = this.root.querySelector<HTMLCanvasElement>("#queueCanvas")!;
    const cell = 24;
    const blockH = 4 * cell;
    const gap = 8;
    this.queueCanvas.width = 4 * cell;
    this.queueCanvas.height = 5 * (blockH + gap) - gap;
    this.queueCtx = this.queueCanvas.getContext("2d")!;

    // Engine
    this.engine = new Engine({
      onFinish: (timeMs) => {
        const records = loadRecords();
        records.sprint40.completedRuns += 1;

        const best = records.sprint40.bestTimeMs;
        if (best === null || timeMs < best) {
          records.sprint40.bestTimeMs = timeMs;
          records.sprint40.bestDateISO = new Date().toISOString();
        }
        saveRecords(records);

        overlay.style.display = "grid";
        overlayText.textContent = formatMs(timeMs);
      },
      onTopOut: () => {
        // Spec: topping out returns to Start screen immediately
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

    // Countdown: ignore input until GO
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
      softDrop: () => {},
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

    const shouldEnable = this.engine.state === "playing" || this.engine.state === "finished";
    this.input.setEnabled(shouldEnable);

    this.engine.update(dt);

    this.raf = requestAnimationFrame(this.loop);
  };

  private updateHud() {
    const timeEl = this.root.querySelector<HTMLSpanElement>("#time")!;
    const remEl = this.root.querySelector<HTMLSpanElement>("#rem")!;
    const holdText = this.root.querySelector<HTMLSpanElement>("#holdText")!;

    timeEl.textContent = formatMs(this.engine.timeMs);
    remEl.textContent = String(this.engine.getLinesRemaining());
    holdText.textContent = this.engine.hold ?? "—";
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

    // Minimal grid lines (optional)
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

    // NEW: render hold + queue previews
    this.renderHoldPreview();
    this.renderQueuePreview();
  }

  private renderHoldPreview() {
    const ctx = this.holdCtx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);

    if (!this.engine.hold) {
      drawEmptyPreview(ctx, this.holdCanvas.width, this.holdCanvas.height);
      return;
    }

    drawPreviewPiece(ctx, this.engine.hold, 0, 0, 24);
  }

  private renderQueuePreview() {
    const ctx = this.queueCtx;
    ctx.clearRect(0, 0, this.queueCanvas.width, this.queueCanvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, this.queueCanvas.width, this.queueCanvas.height);

    const cell = 24;
    const blockH = 4 * cell;
    const gap = 8;

    for (let i = 0; i < 5; i++) {
      const t = this.engine.queue[i];
      const y = i * (blockH + gap);
      if (!t) continue;
      drawPreviewPiece(ctx, t, 0, y, cell);
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
  return ({ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 } as any)[t] ?? 1;
}

function drawEmptyPreview(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawPreviewPiece(
  ctx: CanvasRenderingContext2D,
  type: Tetromino,
  ox: number,
  oy: number,
  cell: number
) {
  const blocks = SHAPES[type][0];

  // compute bounding box so we can center
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y);
  }

  const boxW = (maxX - minX + 1) * cell;
  const boxH = (maxY - minY + 1) * cell;

  const areaW = 4 * cell;
  const areaH = 4 * cell;

  const startX = ox + Math.floor((areaW - boxW) / 2);
  const startY = oy + Math.floor((areaH - boxH) / 2);

  const colorIndex = pieceColorIndex(type);

  // frame
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.strokeRect(ox + 0.5, oy + 0.5, areaW - 1, areaH - 1);

  const colors = ["#0000", "#00bcd4", "#ffb300", "#8e24aa", "#43a047", "#e53935", "#1e88e5", "#fb8c00"];

  for (const b of blocks) {
    const x = startX + (b.x - minX) * cell;
    const y = startY + (b.y - minY) * cell;

    ctx.fillStyle = colors[colorIndex] ?? "#111";
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  }
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

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

  // NEW: overlay canvas above the board for hidden-row piece visibility
  private spawnCanvas!: HTMLCanvasElement;
  private spawnCtx!: CanvasRenderingContext2D;

  private holdCanvas!: HTMLCanvasElement;
  private holdCtx!: CanvasRenderingContext2D;

  private queueCanvas!: HTMLCanvasElement;
  private queueCtx!: CanvasRenderingContext2D;

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

    // NOTE:
    // - boardStage has overflow: visible so the spawnCanvas can show above.
    // - boardClip keeps the board canvas clipped to exactly visible height.
    this.root.innerHTML = `
      <div class="gameLayout">
        <div class="canvasWrap" style="position: relative; padding: 12px; overflow: visible;">
          <div class="boardRow">
            <div class="previewBox">
              <div class="previewTitle">Hold</div>
              <canvas id="holdCanvas" class="previewCanvas"></canvas>
            </div>

            <div id="boardStage" style="position: relative; overflow: visible;">
              <canvas id="spawnCanvas" style="position:absolute; left:0; top:-${HIDDEN_ROWS * CELL}px; pointer-events:none;"></canvas>

              <div id="boardClip" style="position: relative; overflow: hidden;">
                <canvas id="game"></canvas>
                <div class="bigOverlay" id="overlay" style="display:none;"><div></div></div>
              </div>
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
            </div>

            <div style="height: 12px"></div>
            <div class="row">
              <button class="btn" id="homeBtn">Home</button>
              <button class="btn" id="restartBtn">Restart</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(this.root);

    /* ---------- canvases ---------- */

    // Board canvas stays EXACTLY visible height (no preview area)
    this.canvas = this.root.querySelector<HTMLCanvasElement>("#game")!;
    this.canvas.width = COLS * CELL;
    this.canvas.height = VISIBLE_ROWS * CELL;
    this.ctx = this.canvas.getContext("2d")!;

    // Spawn overlay canvas renders only the blocks above the board (hidden rows)
    this.spawnCanvas = this.root.querySelector<HTMLCanvasElement>("#spawnCanvas")!;
    this.spawnCanvas.width = COLS * CELL;
    this.spawnCanvas.height = HIDDEN_ROWS * CELL;
    this.spawnCtx = this.spawnCanvas.getContext("2d")!;

    // Make sure the boardClip matches the board canvas size
    const boardClip = this.root.querySelector<HTMLDivElement>("#boardClip")!;
    boardClip.style.width = `${this.canvas.width}px`;
    boardClip.style.height = `${this.canvas.height}px`;

    // Hold preview
    this.holdCanvas = this.root.querySelector<HTMLCanvasElement>("#holdCanvas")!;
    this.holdCanvas.width = 4 * CELL;
    this.holdCanvas.height = 4 * CELL;
    this.holdCtx = this.holdCanvas.getContext("2d")!;

    // Queue preview (compact)
    this.queueCanvas = this.root.querySelector<HTMLCanvasElement>("#queueCanvas")!;
    this.queueCanvas.width = 4 * CELL;
    this.queueCanvas.height = 14 * CELL;
    this.queueCtx = this.queueCanvas.getContext("2d")!;

    /* ---------- engine ---------- */

    const overlay = this.root.querySelector<HTMLDivElement>("#overlay")!;
    const overlayText = overlay.querySelector("div")!;

    this.engine = new Engine({
      onFinish: (timeMs) => {
        const records = loadRecords();
        records.sprint40.completedRuns++;

        if (records.sprint40.bestTimeMs === null || timeMs < records.sprint40.bestTimeMs) {
          records.sprint40.bestTimeMs = timeMs;
          records.sprint40.bestDateISO = new Date().toISOString();
        }

        saveRecords(records);

        overlay.style.display = "grid";
        overlayText.textContent = formatMs(timeMs);
      },
      onTopOut: () => this.router.go("start"),
      onTick: () => {
        this.render();
        this.updateHud();
        this.updateOverlay();
      },
    });

    this.engine.startNewRun();

    /* ---------- input ---------- */

    this.input = new InputManager(keybinds);
    this.input.mount();
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

    this.root.querySelector("#homeBtn")!.addEventListener("click", () => this.router.go("start"));
    this.root.querySelector("#restartBtn")!.addEventListener("click", () => this.engine.restart());

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);

    // initial paint
    this.render();
    this.updateHud();
    this.updateOverlay();
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    this.input.unmount();
    this.root.remove();
  }

  private loop = (t: number) => {
    const dt = Math.min(50, t - this.last);
    this.last = t;

    // Enable input only during play
    this.input.setEnabled(this.engine.state === "playing");

    this.engine.update(dt);

    this.raf = requestAnimationFrame(this.loop);
  };

  private updateHud() {
    this.root.querySelector<HTMLSpanElement>("#time")!.textContent = formatMs(this.engine.timeMs);
    this.root.querySelector<HTMLSpanElement>("#rem")!.textContent = String(this.engine.getLinesRemaining());
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

  /* ---------- render ---------- */

  private render() {
    // 1) Draw the normal board (ONLY visible rows)
    this.renderBoard();

    // 2) Draw the spawn overlay (ONLY blocks above the board, no background)
    this.renderSpawnOverlay();

    // 3) Previews
    this.renderHoldPreview();
    this.renderQueuePreview();
  }

  private renderBoard() {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // locked cells (visible only)
    for (let y = HIDDEN_ROWS; y < ROWS; y++) {
      const vy = y - HIDDEN_ROWS; // 0..VISIBLE_ROWS-1
      for (let x = 0; x < COLS; x++) {
        const v = this.engine.board.grid[y][x];
        if (v) drawCell(ctx, x, vy, v);
      }
    }

    // active piece blocks that are in visible rows only
    const a = this.engine.active;
    if (a) {
      const blocks = SHAPES[a.type][a.rot];
      const color = pieceColorIndex(a.type);

      for (const b of blocks) {
        const boardY = a.y + b.y;
        if (boardY < HIDDEN_ROWS) continue;
        if (boardY >= ROWS) continue;

        const vy = boardY - HIDDEN_ROWS;
        if (vy >= 0 && vy < VISIBLE_ROWS) {
          drawCell(ctx, a.x + b.x, vy, color);
        }
      }
    }

    // grid lines (visible board only)
    this.drawGrid();
  }

  private renderSpawnOverlay() {
    const ctx = this.spawnCtx;

    // transparent background: just clear
    ctx.clearRect(0, 0, this.spawnCanvas.width, this.spawnCanvas.height);

    const a = this.engine.active;
    if (!a) return;

    const blocks = SHAPES[a.type][a.rot];
    const color = pieceColorIndex(a.type);

    // draw ONLY blocks above the visible playfield (boardY < HIDDEN_ROWS)
    for (const b of blocks) {
      const boardY = a.y + b.y;
      if (boardY < 0 || boardY >= HIDDEN_ROWS) continue;

      const pxY = boardY * CELL; // 0..HIDDEN_ROWS*CELL
      drawCellPixels(ctx, (a.x + b.x) * CELL, pxY, CELL, color);
    }
  }

  private drawGrid() {
    const ctx = this.ctx;

    ctx.strokeStyle = "rgba(0,0,0,0.06)";

    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, VISIBLE_ROWS * CELL);
      ctx.stroke();
    }

    for (let y = 0; y <= VISIBLE_ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(COLS * CELL, y * CELL + 0.5);
      ctx.stroke();
    }
  }

  private renderHoldPreview() {
    const ctx = this.holdCtx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);

    if (!this.engine.hold) return;
    drawPreviewPieceSeamless(ctx, this.engine.hold, 0, 0, CELL);
  }

  private renderQueuePreview() {
    const ctx = this.queueCtx;
    ctx.clearRect(0, 0, this.queueCanvas.width, this.queueCanvas.height);

    const spacing = CELL; // exactly one block between pieces
    let y = 0;

    for (const t of this.engine.queue) {
      const h = drawPreviewPieceSeamless(ctx, t, 0, y, CELL);
      y += h + spacing;
    }
  }
}

/* ---------- helpers ---------- */

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, c: number) {
  const colors = ["", "#00bcd4", "#ffb300", "#8e24aa", "#43a047", "#e53935", "#1e88e5", "#fb8c00"];
  ctx.fillStyle = colors[c];
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
}

// Pixel-positioned cell for the spawn overlay canvas
function drawCellPixels(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  colorIndex: number
) {
  const colors = ["", "#00bcd4", "#ffb300", "#8e24aa", "#43a047", "#e53935", "#1e88e5", "#fb8c00"];
  ctx.fillStyle = colors[colorIndex];
  ctx.fillRect(px, py, size, size);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

function drawPreviewPieceSeamless(
  ctx: CanvasRenderingContext2D,
  type: Tetromino,
  ox: number,
  oy: number,
  cell: number
): number {
  const blocks = SHAPES[type][0];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y);
  }

  const h = (maxY - minY + 1) * cell;
  const w = (maxX - minX + 1) * cell;
  const startX = ox + Math.floor((4 * cell - w) / 2);

  const color = pieceColorIndex(type);
  const colors = ["", "#00bcd4", "#ffb300", "#8e24aa", "#43a047", "#e53935", "#1e88e5", "#fb8c00"];

  for (const b of blocks) {
    const x = startX + (b.x - minX) * cell;
    const y = oy + (b.y - minY) * cell;

    ctx.fillStyle = colors[color];
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
  }

  return h;
}

function pieceColorIndex(t: Tetromino): number {
  return { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[t];
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
}

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: block-placement line-clear puzzle (1010 / Block Blast).
// Drag one of the three offered pieces onto the grid. Fill full rows or columns
// to clear them. When no piece fits, it's game over. R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
let WIDTH = Math.max(240, Math.floor(window.innerWidth || 960));
let HEIGHT = Math.max(240, Math.floor(window.innerHeight || 540));
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener("resize", () => {
  WIDTH = canvas.width = Math.max(240, Math.floor(window.innerWidth || 960));
  HEIGHT = canvas.height = Math.max(240, Math.floor(window.innerHeight || 540));
  layout();
});

const colors = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const N = 8;
const SHAPES = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]]
];
let grid, tray, score, over, cell, ox, oy, drag;

function layout() {
  cell = Math.min((WIDTH - 40) / N, (HEIGHT - 240) / N);
  ox = (WIDTH - cell * N) / 2; oy = 80;
}
function randShape() { return { cells: SHAPES[Math.floor(Math.random() * SHAPES.length)], color: Math.floor(Math.random() * colors.length) }; }
function reset() {
  layout();
  grid = Array.from({ length: N }, () => Array(N).fill(-1));
  tray = [randShape(), randShape(), randShape()];
  score = 0; over = false; drag = null;
}
reset();

function fits(shape, gr, gc) {
  return shape.cells.every(([dr, dc]) => {
    const r = gr + dr, c = gc + dc;
    return r >= 0 && c >= 0 && r < N && c < N && grid[r][c] === -1;
  });
}
function anyFits() {
  return tray.some((s) => s && (() => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(s, r, c)) return true; return false; })());
}
function place(idx, gr, gc) {
  const s = tray[idx];
  if (!fits(s, gr, gc)) return false;
  s.cells.forEach(([dr, dc]) => (grid[gr + dr][gc + dc] = s.color));
  score += s.cells.length;
  tray[idx] = null;
  clearLines();
  if (tray.every((t) => !t)) tray = [randShape(), randShape(), randShape()];
  if (!anyFits()) over = true;
  return true;
}
function clearLines() {
  const fullRows = [], fullCols = [];
  for (let r = 0; r < N; r++) if (grid[r].every((c) => c !== -1)) fullRows.push(r);
  for (let c = 0; c < N; c++) if (grid.every((row) => row[c] !== -1)) fullCols.push(c);
  for (const r of fullRows) grid[r] = Array(N).fill(-1);
  for (const c of fullCols) for (let r = 0; r < N; r++) grid[r][c] = -1;
  score += (fullRows.length + fullCols.length) * 10;
}

function trayPos(i) { const w = WIDTH / 3; return { x: w * i + w / 2, y: oy + N * cell + 70 }; }

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score, 20, 50);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = ox + c * cell, y = oy + r * cell;
    ctx.fillStyle = grid[r][c] === -1 ? "#141d33" : colors[grid[r][c] % colors.length];
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  }
  // drag preview
  if (drag && drag.gr != null) {
    const s = tray[drag.idx];
    if (s) {
      const ok = fits(s, drag.gr, drag.gc);
      ctx.globalAlpha = 0.5;
      s.cells.forEach(([dr, dc]) => {
        ctx.fillStyle = ok ? colors[s.color % colors.length] : "#ff5555";
        ctx.fillRect(ox + (drag.gc + dc) * cell + 1, oy + (drag.gr + dr) * cell + 1, cell - 2, cell - 2);
      });
      ctx.globalAlpha = 1;
    }
  }
  const tcell = cell * 0.7;
  for (let i = 0; i < 3; i++) {
    const s = tray[i]; if (!s || (drag && drag.idx === i)) continue;
    const p = trayPos(i);
    s.cells.forEach(([dr, dc]) => {
      ctx.fillStyle = colors[s.color % colors.length];
      ctx.fillRect(p.x + dc * tcell - tcell, p.y + dr * tcell - tcell, tcell - 2, tcell - 2);
    });
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over — " + score, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

function at(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const p = at(e);
  const tcell = cell * 0.7;
  for (let i = 0; i < 3; i++) {
    if (!tray[i]) continue;
    const tp = trayPos(i);
    if (Math.abs(p.x - tp.x) < tcell * 2 && Math.abs(p.y - tp.y) < tcell * 2) { drag = { idx: i, gr: null, gc: null }; return; }
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = at(e);
  drag.gc = Math.round((p.x - ox - cell / 2) / cell);
  drag.gr = Math.round((p.y - oy - cell * 1.5) / cell);
});
window.addEventListener("pointerup", () => {
  if (drag && drag.gr != null) place(drag.idx, drag.gr, drag.gc);
  drag = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

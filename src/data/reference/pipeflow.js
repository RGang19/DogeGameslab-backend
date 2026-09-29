import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: rotate-the-pipes connection puzzle (Pipes / FlowFree-lite).
// Tap a pipe tile to rotate it 90°. Connect the source (left) to the drain
// (right) so water flows through. Solve to win. R generates a new board.

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
const COLS = 6, ROWS = 5;
// connection bitmask: 1=up 2=right 4=down 8=left
let grid, filled, won, cell, ox, oy;

function rotMask(m) { return ((m << 1) | (m >> 3)) & 15; }
function layout() {
  cell = Math.min((WIDTH - 40) / COLS, (HEIGHT - 120) / ROWS);
  ox = (WIDTH - cell * COLS) / 2; oy = 90;
}
function reset() {
  layout();
  // build a guaranteed path then add random pipes, then scramble rotations
  grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
  let r = Math.floor(ROWS / 2), c = 0;
  grid[r][c] |= 8; // entry from left
  while (c < COLS - 1) {
    const goDown = r < ROWS - 1 && Math.random() < 0.4;
    const goUp = r > 0 && Math.random() < 0.4;
    if (goDown) { grid[r][c] |= 4; grid[r + 1][c] |= 1; r++; }
    else if (goUp) { grid[r][c] |= 1; grid[r - 1][c] |= 4; r--; }
    else { grid[r][c] |= 2; grid[r][c + 1] |= 8; c++; }
  }
  grid[r][COLS - 1] |= 2; // exit to right
  // random filler pipes on empty cells
  for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
    if (grid[rr][cc] === 0) grid[rr][cc] = [3, 6, 12, 9, 5, 10][Math.floor(Math.random() * 6)];
  }
  // scramble
  for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
    const n = Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) grid[rr][cc] = rotMask(grid[rr][cc]);
  }
  computeFlow();
  won = false;
}
function computeFlow() {
  filled = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
  const start = Math.floor(ROWS / 2);
  const stack = [[start, 0]];
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS || filled[r][c]) continue;
    filled[r][c] = true;
    const m = grid[r][c];
    if ((m & 1) && r > 0 && (grid[r - 1][c] & 4)) stack.push([r - 1, c]);
    if ((m & 4) && r < ROWS - 1 && (grid[r + 1][c] & 1)) stack.push([r + 1, c]);
    if ((m & 8) && c > 0 && (grid[r][c - 1] & 2)) stack.push([r, c - 1]);
    if ((m & 2) && c < COLS - 1 && (grid[r][c + 1] & 8)) stack.push([r, c + 1]);
  }
  won = filled[Math.floor(ROWS / 2)][COLS - 1] && (grid[Math.floor(ROWS / 2)][COLS - 1] & 2);
}
reset();

function drawPipe(x, y, m, on) {
  const cx = x + cell / 2, cy = y + cell / 2;
  ctx.strokeStyle = on ? colors[0] : "#5a6b94";
  ctx.lineWidth = cell * 0.18; ctx.lineCap = "round";
  ctx.beginPath();
  if (m & 1) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y); }
  if (m & 2) { ctx.moveTo(cx, cy); ctx.lineTo(x + cell, cy); }
  if (m & 4) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y + cell); }
  if (m & 8) { ctx.moveTo(cx, cy); ctx.lineTo(x, cy); }
  ctx.stroke();
  ctx.lineWidth = 1;
}
function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center"; ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("Tap pipes to rotate — connect left to right", WIDTH / 2, 50);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = ox + c * cell, y = oy + r * cell;
    ctx.fillStyle = "#11192c"; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    drawPipe(x, y, grid[r][c], filled[r][c]);
  }
  const sy = oy + Math.floor(ROWS / 2) * cell + cell / 2;
  ctx.fillStyle = colors[2];
  ctx.fillRect(ox - 14, sy - 6, 14, 12);
  ctx.fillRect(ox + COLS * cell, sy - 6, 14, 12);
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Flowing!", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap for a new board", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  if (won) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - r.left - ox) / cell);
  const row = Math.floor((e.clientY - r.top - oy) / cell);
  if (c >= 0 && c < COLS && row >= 0 && row < ROWS) {
    grid[row][c] = rotMask(grid[row][c]);
    computeFlow();
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Connect Four vs AI.
// Tap a column to drop your disc. Connect four in a row (any direction) before
// the AI does. R restarts.

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
const COLS = 7, ROWS = 6;
let board, turn, result, cell, ox, oy;

function layout() {
  cell = Math.min((WIDTH - 40) / COLS, (HEIGHT - 140) / ROWS);
  ox = (WIDTH - cell * COLS) / 2; oy = 100;
}
function reset() { layout(); board = Array.from({ length: ROWS }, () => Array(COLS).fill(0)); turn = 1; result = null; }
reset();

function drop(b, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[r][col]) { b[r][col] = player; return r; }
  return -1;
}
function wins(b, player) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let k = 0;
      for (; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS || b[rr][cc] !== player) break; }
      if (k === 4) return true;
    }
  }
  return false;
}
function full(b) { return b[0].every((x) => x); }

function aiMove() {
  // 1) win if possible 2) block player 3) prefer center
  const tryCol = (player) => {
    for (let c = 0; c < COLS; c++) {
      const b = board.map((row) => row.slice());
      if (drop(b, c, player) >= 0 && wins(b, player)) return c;
    }
    return -1;
  };
  let col = tryCol(2);
  if (col < 0) col = tryCol(1);
  if (col < 0) {
    const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => !board[0][c]);
    col = order[0];
  }
  drop(board, col, 2);
  if (wins(board, 2)) result = "AI wins";
  else if (full(board)) result = "Draw";
  turn = 1;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center"; ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("You vs AI", WIDTH / 2, 56);
  ctx.fillStyle = "#1c3160";
  ctx.fillRect(ox - 6, oy - 6, cell * COLS + 12, cell * ROWS + 12);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = ox + c * cell + cell / 2, y = oy + r * cell + cell / 2;
    ctx.fillStyle = board[r][c] === 1 ? colors[0] : board[r][c] === 2 ? colors[1] : "#0a1020";
    ctx.beginPath(); ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  if (result) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(result, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  if (result) { reset(); return; }
  if (turn !== 1) return;
  const r = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - r.left - ox) / cell);
  if (c < 0 || c >= COLS || board[0][c]) return;
  drop(board, c, 1);
  if (wins(board, 1)) { result = "You win!"; return; }
  if (full(board)) { result = "Draw"; return; }
  turn = 2;
  setTimeout(aiMove, 300);
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: rolling-block maze (Bloxorz style).
// A 1x2 block rolls across a grid of tiles. Arrows / swipe to roll it.
// Roll it upright onto the goal cell without falling off. R restarts.

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
const MAP = gamePackage?.gameplay?.map ?? [
  "111100",
  "111110",
  "011111",
  "001G110",
  "000111"
];
let board, rows, cols, goal, block, moves, won, over, cell, ox, oy;

function layout() {
  rows = board.length; cols = Math.max(...board.map((r) => r.length));
  cell = Math.min((WIDTH - 40) / cols, (HEIGHT - 140) / rows);
  ox = (WIDTH - cell * cols) / 2;
  oy = 100;
}
function reset() {
  board = MAP.map((r) => r.padEnd(Math.max(...MAP.map((x) => x.length)), "0").split(""));
  goal = null;
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    if (board[r][c] === "G") { goal = { r, c }; board[r][c] = "1"; }
  }
  layout();
  // block occupies two cells: {a:{r,c}, b:{r,c}}; standing if a==b
  let start = null;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === "1" && !start) start = { r, c };
  block = { a: { ...start }, b: { ...start } };
  moves = 0;
  won = false;
  over = false;
}
reset();

function solid(r, c) { return board[r] && board[r][c] === "1"; }
function cellsOk() {
  return solid(block.a.r, block.a.c) && solid(block.b.r, block.b.c);
}
function standing() { return block.a.r === block.b.r && block.a.c === block.b.c; }

function roll(dr, dc) {
  if (won || over) return;
  const a = block.a, b = block.b;
  let na, nb;
  if (standing()) {
    na = { r: a.r + dr, c: a.c + dc };
    nb = { r: a.r + 2 * dr, c: a.c + 2 * dc };
    if (dr === 0) { na = { r: a.r, c: dc > 0 ? a.c + 1 : a.c - 2 }; nb = { r: a.r, c: dc > 0 ? a.c + 2 : a.c - 1 }; }
    else { na = { r: dr > 0 ? a.r + 1 : a.r - 2, c: a.c }; nb = { r: dr > 0 ? a.r + 2 : a.r - 1, c: a.c }; }
  } else {
    const horiz = a.r === b.r;
    if ((dc !== 0 && horiz) || (dr !== 0 && !horiz)) {
      // rolling along long axis -> becomes standing
      if (dc > 0) { na = nb = { r: a.r, c: Math.max(a.c, b.c) + 1 }; }
      else if (dc < 0) { na = nb = { r: a.r, c: Math.min(a.c, b.c) - 1 }; }
      else if (dr > 0) { na = nb = { r: Math.max(a.r, b.r) + 1, c: a.c }; }
      else { na = nb = { r: Math.min(a.r, b.r) - 1, c: a.c }; }
    } else {
      // rolling across short axis -> stays lying, both cells shift
      na = { r: a.r + dr, c: a.c + dc };
      nb = { r: b.r + dr, c: b.c + dc };
    }
  }
  block = { a: na, b: nb };
  moves += 1;
  if (!cellsOk()) { over = true; return; }
  if (standing() && goal && block.a.r === goal.r && block.a.c === goal.c) won = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Moves " + moves, WIDTH / 2, 50);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!solid(r, c)) continue;
    ctx.fillStyle = "#1d2942";
    ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
  }
  if (goal) {
    ctx.strokeStyle = colors[2]; ctx.lineWidth = 3;
    ctx.strokeRect(ox + goal.c * cell + 4, oy + goal.r * cell + 4, cell - 8, cell - 8);
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = colors[0];
  for (const p of [block.a, block.b]) ctx.fillRect(ox + p.c * cell + 3, oy + p.r * cell + 3, cell - 6, cell - 6);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Solved!" : "Fell off", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") roll(-1, 0);
  if (e.code === "ArrowDown" || e.code === "KeyS") roll(1, 0);
  if (e.code === "ArrowLeft" || e.code === "KeyA") roll(0, -1);
  if (e.code === "ArrowRight" || e.code === "KeyD") roll(0, 1);
  if (e.code === "KeyR") reset();
  if (e.code.startsWith("Arrow")) e.preventDefault();
});
let sx, sy;
canvas.addEventListener("pointerdown", (e) => {
  if (won || over) { reset(); return; }
  sx = e.clientX; sy = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  if (sx == null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dx) < 14 && Math.abs(dy) < 14) { sx = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) roll(0, Math.sign(dx));
  else roll(Math.sign(dy), 0);
  sx = null;
});

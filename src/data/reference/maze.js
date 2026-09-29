import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: procedural maze runner.
// Arrows / WASD / swipe to move from the start to the green exit. Each win
// generates a bigger maze. R restarts.

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
let cols, rows, cells, player, level, won, cell, ox, oy;

function gen(c, r) {
  cols = c; rows = r;
  cells = Array.from({ length: r }, () => Array.from({ length: c }, () => ({ n: 1, e: 1, s: 1, w: 1, v: false })));
  const stack = [{ x: 0, y: 0 }];
  cells[0][0].v = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const dirs = [];
    if (cur.y > 0 && !cells[cur.y - 1][cur.x].v) dirs.push("n");
    if (cur.x < c - 1 && !cells[cur.y][cur.x + 1].v) dirs.push("e");
    if (cur.y < r - 1 && !cells[cur.y + 1][cur.x].v) dirs.push("s");
    if (cur.x > 0 && !cells[cur.y][cur.x - 1].v) dirs.push("w");
    if (!dirs.length) { stack.pop(); continue; }
    const d = dirs[Math.floor(Math.random() * dirs.length)];
    const cell0 = cells[cur.y][cur.x];
    let nx = cur.x, ny = cur.y;
    if (d === "n") { cell0.n = 0; ny--; cells[ny][nx].s = 0; }
    if (d === "e") { cell0.e = 0; nx++; cells[ny][nx].w = 0; }
    if (d === "s") { cell0.s = 0; ny++; cells[ny][nx].n = 0; }
    if (d === "w") { cell0.w = 0; nx--; cells[ny][nx].e = 0; }
    cells[ny][nx].v = true;
    stack.push({ x: nx, y: ny });
  }
}
function layout() {
  cell = Math.min((WIDTH - 40) / cols, (HEIGHT - 120) / rows);
  ox = (WIDTH - cell * cols) / 2;
  oy = 90;
}
function reset() { level = 1; start(); }
function start() {
  gen(6 + level, 8 + level);
  layout();
  player = { x: 0, y: 0 };
  won = false;
}
reset();

function move(dx, dy) {
  if (won) return;
  const c = cells[player.y][player.x];
  if (dx === 1 && !c.e) player.x++;
  if (dx === -1 && !c.w) player.x--;
  if (dy === 1 && !c.s) player.y++;
  if (dy === -1 && !c.n) player.y--;
  if (player.x === cols - 1 && player.y === rows - 1) won = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Maze " + level, WIDTH / 2, 50);
  ctx.strokeStyle = "#5a6b94";
  ctx.lineWidth = Math.max(1, cell * 0.08);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = cells[y][x], px = ox + x * cell, py = oy + y * cell;
    ctx.beginPath();
    if (c.n) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
    if (c.e) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
    if (c.s) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
    if (c.w) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.fillStyle = colors[2];
  ctx.fillRect(ox + (cols - 1) * cell + cell * 0.2, oy + (rows - 1) * cell + cell * 0.2, cell * 0.6, cell * 0.6);
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(ox + player.x * cell + cell / 2, oy + player.y * cell + cell / 2, cell * 0.3, 0, Math.PI * 2); ctx.fill();
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Escaped!", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Tap for next maze", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (won && (e.code === "Space" || e.code === "Enter")) { level++; start(); return; }
  if (e.code === "ArrowUp" || e.code === "KeyW") move(0, -1);
  if (e.code === "ArrowDown" || e.code === "KeyS") move(0, 1);
  if (e.code === "ArrowLeft" || e.code === "KeyA") move(-1, 0);
  if (e.code === "ArrowRight" || e.code === "KeyD") move(1, 0);
  if (e.code === "KeyR") reset();
  if (e.code.startsWith("Arrow")) e.preventDefault();
});
let sx, sy;
canvas.addEventListener("pointerdown", (e) => {
  if (won) { level++; start(); return; }
  sx = e.clientX; sy = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  if (sx == null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { sx = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
  else move(0, Math.sign(dy));
  sx = null;
});

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Sokoban box-pushing puzzle.
// Arrows / WASD / swipe to move. Push every crate onto a target pad. You can't
// pull crates. Z undoes, R restarts the level.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
let WIDTH = Math.max(240, Math.floor(window.innerWidth || 960));
let HEIGHT = Math.max(240, Math.floor(window.innerHeight || 540));
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener("resize", () => {
  WIDTH = canvas.width = Math.max(240, Math.floor(window.innerWidth || 960));
  HEIGHT = canvas.height = Math.max(240, Math.floor(window.innerHeight || 540));
});

const colors = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const LEVELS = gamePackage?.gameplay?.levels ?? [
  ["#######", "#  .  #", "# $$$ #", "# .@. #", "#  $  #", "#  .  #", "#######"],
  ["########", "#  .   #", "# $##$ #", "# .@ . #", "# $##$ #", "#   .  #", "########"]
];
let level, grid, player, boxes, targets, history, won, cell, ox, oy;

function loadLevel(n) {
  const map = LEVELS[n % LEVELS.length];
  grid = [];
  boxes = [];
  targets = [];
  for (let r = 0; r < map.length; r++) {
    grid[r] = [];
    for (let c = 0; c < map[r].length; c++) {
      const ch = map[r][c];
      grid[r][c] = ch === "#" ? 1 : 0;
      if (ch === "@") player = { r, c };
      if (ch === "$") boxes.push({ r, c });
      if (ch === ".") targets.push({ r, c });
    }
  }
  const rows = map.length, cols = Math.max(...map.map((m) => m.length));
  cell = Math.min((WIDTH - 40) / cols, (HEIGHT - 120) / rows);
  ox = (WIDTH - cell * cols) / 2;
  oy = 90;
  history = [];
  won = false;
}
function reset() { level = 0; loadLevel(level); }
reset();

function boxAt(r, c) { return boxes.find((b) => b.r === r && b.c === c); }
function wall(r, c) { return !grid[r] || grid[r][c] === undefined || grid[r][c] === 1; }

function move(dr, dc) {
  if (won) return;
  const nr = player.r + dr, nc = player.c + dc;
  if (wall(nr, nc)) return;
  const b = boxAt(nr, nc);
  if (b) {
    const br = nr + dr, bc = nc + dc;
    if (wall(br, bc) || boxAt(br, bc)) return;
    history.push({ p: { ...player }, b: boxes.map((x) => ({ ...x })) });
    b.r = br; b.c = bc;
  } else {
    history.push({ p: { ...player }, b: boxes.map((x) => ({ ...x })) });
  }
  player.r = nr; player.c = nc;
  if (boxes.every((bx) => targets.some((t) => t.r === bx.r && t.c === bx.c))) {
    won = true;
  }
}
function undo() {
  const h = history.pop();
  if (!h) return;
  player = h.p; boxes = h.b;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Level " + (level + 1), WIDTH / 2, 50);
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
    const x = ox + c * cell, y = oy + r * cell;
    if (grid[r][c] === 1) { ctx.fillStyle = "#2b3a5c"; ctx.fillRect(x, y, cell - 1, cell - 1); }
    else { ctx.fillStyle = "#11192c"; ctx.fillRect(x, y, cell - 1, cell - 1); }
  }
  for (const t of targets) {
    ctx.fillStyle = colors[2];
    ctx.beginPath(); ctx.arc(ox + t.c * cell + cell / 2, oy + t.r * cell + cell / 2, cell * 0.14, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of boxes) {
    const on = targets.some((t) => t.r === b.r && t.c === b.c);
    ctx.fillStyle = on ? colors[0] : "#a9762f";
    ctx.fillRect(ox + b.c * cell + 4, oy + b.r * cell + 4, cell - 9, cell - 9);
  }
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(ox + player.c * cell + cell / 2, oy + player.r * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); ctx.fill();
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Solved!", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Tap for next level", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

window.addEventListener("keydown", (e) => {
  if (won && (e.code === "Space" || e.code === "Enter")) { level += 1; loadLevel(level); return; }
  if (e.code === "ArrowUp" || e.code === "KeyW") move(-1, 0);
  if (e.code === "ArrowDown" || e.code === "KeyS") move(1, 0);
  if (e.code === "ArrowLeft" || e.code === "KeyA") move(0, -1);
  if (e.code === "ArrowRight" || e.code === "KeyD") move(0, 1);
  if (e.code === "KeyZ") undo();
  if (e.code === "KeyR") loadLevel(level);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
let sx, sy;
canvas.addEventListener("pointerdown", (e) => {
  if (won) { level += 1; loadLevel(level); return; }
  sx = e.clientX; sy = e.clientY;
});
canvas.addEventListener("pointerup", (e) => {
  if (sx == null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dx) < 14 && Math.abs(dy) < 14) { sx = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) move(0, Math.sign(dx));
  else move(Math.sign(dy), 0);
  sx = null;
});

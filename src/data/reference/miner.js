import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: dig-down miner (Noob Miner / Motherload style).
// Arrows / WASD to move and dig through dirt. Collect ore for points. Deeper ore
// is worth more. R restarts.

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
const TS = 44;
const COLS = () => Math.floor(WIDTH / TS);
let grid, player, score, moveCd;

function reset() {
  grid = {};
  player = { c: Math.floor(COLS() / 2), r: 0 };
  score = 0;
  moveCd = 0;
}
function cell(c, r) {
  const k = c + "," + r;
  if (!(k in grid)) {
    if (r <= 0) grid[k] = "sky";
    else {
      const roll = Math.random();
      if (roll < 0.08 + r * 0.004) grid[k] = "ore";
      else if (roll < 0.12) grid[k] = "rock";
      else grid[k] = "dirt";
    }
  }
  return grid[k];
}
reset();

function tryMove(dc, dr) {
  const nc = player.c + dc, nr = player.r + dr;
  if (nc < 0 || nc >= COLS() || nr < 0) return;
  const t = cell(nc, nr);
  if (t === "rock") return;
  if (t === "ore") { score += 10 + nr; }
  grid[nc + "," + nr] = "empty";
  player.c = nc; player.r = nr;
}

const keys = {};
function update(dt) {
  moveCd -= dt;
  if (moveCd > 0) return;
  let moved = false;
  if (keys["left"]) { tryMove(-1, 0); moved = true; }
  else if (keys["right"]) { tryMove(1, 0); moved = true; }
  else if (keys["down"]) { tryMove(0, 1); moved = true; }
  else if (keys["up"]) { tryMove(0, -1); moved = true; }
  if (moved) moveCd = 0.12;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const camR = player.r - Math.floor(HEIGHT / TS / 2);
  const rows = Math.ceil(HEIGHT / TS) + 1;
  for (let sr = 0; sr < rows; sr++) {
    const r = camR + sr;
    for (let c = 0; c < COLS(); c++) {
      const t = r < 0 ? "sky" : cell(c, r);
      const x = c * TS, y = (sr) * TS;
      if (t === "sky") ctx.fillStyle = "#16243f";
      else if (t === "dirt") ctx.fillStyle = "#6b4a2b";
      else if (t === "rock") ctx.fillStyle = "#3a3f4a";
      else if (t === "ore") ctx.fillStyle = colors[2];
      else continue;
      ctx.fillRect(x, y, TS - 1, TS - 1);
    }
  }
  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(player.c * TS + 4, (player.r - camR) * TS + 4, TS - 9, TS - 9);
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Ore $" + score + "   Depth " + player.r, 20, 36);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function setKey(code, on) {
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (code === "ArrowDown" || code === "KeyS") keys["down"] = on;
  if (code === "ArrowUp" || code === "KeyW") keys["up"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => {
  if (e.code.startsWith("Arrow")) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const dx = x - WIDTH / 2, dy = y - HEIGHT / 2;
  if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0);
  else tryMove(0, Math.sign(dy));
});

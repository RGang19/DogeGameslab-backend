import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Tron light-cycles.
// Steer your trail with arrows / A-D (turn left/right) or tap left/right half.
// Don't hit walls or any trail. Outlast the AI rider. R restarts.

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
const GRID = 6;
let cols, rows, occ, me, ai, over, msg, tick;

function layout() { cols = Math.floor(WIDTH / GRID); rows = Math.floor((HEIGHT - 60) / GRID); }
function reset() {
  layout();
  occ = new Set();
  me = { x: Math.floor(cols * 0.25), y: Math.floor(rows / 2), dx: 1, dy: 0, alive: true };
  ai = { x: Math.floor(cols * 0.75), y: Math.floor(rows / 2), dx: -1, dy: 0, alive: true };
  over = false; msg = ""; tick = 0;
}
reset();

function key(x, y) { return x + "," + y; }
function dead(r, x, y) { return x < 0 || y < 0 || x >= cols || y >= rows || occ.has(key(x, y)); }

function aiTurn() {
  const ahead = { x: ai.x + ai.dx, y: ai.y + ai.dy };
  if (dead(ai, ahead.x, ahead.y) || Math.random() < 0.06) {
    const turns = [[ai.dy, -ai.dx], [-ai.dy, ai.dx]];
    for (const [dx, dy] of turns.sort(() => Math.random() - 0.5)) {
      if (!dead(ai, ai.x + dx, ai.y + dy)) { ai.dx = dx; ai.dy = dy; break; }
    }
  }
}

function step() {
  if (over) return;
  occ.add(key(me.x, me.y));
  occ.add(key(ai.x, ai.y));
  aiTurn();
  const nm = { x: me.x + me.dx, y: me.y + me.dy };
  const na = { x: ai.x + ai.dx, y: ai.y + ai.dy };
  const meDead = dead(me, nm.x, nm.y) || (nm.x === na.x && nm.y === na.y);
  const aiDead = dead(ai, na.x, na.y) || (nm.x === na.x && nm.y === na.y);
  if (meDead || aiDead) {
    over = true;
    msg = meDead && aiDead ? "Draw" : meDead ? "You crashed" : "You win!";
    return;
  }
  me.x = nm.x; me.y = nm.y; ai.x = na.x; ai.y = na.y;
}

function update(dt) {
  tick += dt;
  if (tick >= 0.05) { tick = 0; step(); }
}
function turnMe(left) {
  if (left) { const d = me.dx; me.dx = me.dy; me.dy = -d; }
  else { const d = me.dx; me.dx = -me.dy; me.dy = d; }
}

function render() {
  ctx.fillStyle = "#05070f";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // single-tint trails (rider owners drawn on top in their own colors)
  ctx.fillStyle = "#243a63";
  for (const k of occ) { const [x, y] = k.split(",").map(Number); ctx.fillRect(x * GRID, 60 + y * GRID, GRID - 1, GRID - 1); }
  ctx.fillStyle = colors[0];
  ctx.fillRect(me.x * GRID, 60 + me.y * GRID, GRID, GRID);
  ctx.fillStyle = colors[1];
  ctx.fillRect(ai.x * GRID, 60 + ai.y * GRID, GRID, GRID);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("Turn left/right to steer", 20, 36);
  if (over) {
    ctx.fillStyle = "rgba(5,7,15,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(msg, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
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

window.addEventListener("keydown", (e) => {
  if (over && e.code === "KeyR") { reset(); return; }
  if (e.code === "ArrowLeft" || e.code === "KeyA") turnMe(true);
  if (e.code === "ArrowRight" || e.code === "KeyD") turnMe(false);
  if (e.code === "KeyR") reset();
});
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  turnMe(e.clientX - r.left < WIDTH / 2);
});

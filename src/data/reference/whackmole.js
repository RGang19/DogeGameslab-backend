import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Whack-a-Mole reflex game.
// Moles pop out of holes — tap them before they duck back. Tap a bomb and you
// lose. 30-second timer. R restarts.

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
const COLS = 3, ROWS = 3;
let holes, score, time, spawn, over;

function layout() {
  holes = [];
  const w = WIDTH / (COLS + 1), h = (HEIGHT - 140) / (ROWS + 1);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    holes.push({ x: w * (c + 1), y: 120 + h * (r + 1), r: Math.min(w, h) * 0.32, up: 0, bomb: false, active: false });
  }
}
function reset() {
  layout();
  score = 0;
  time = 30;
  spawn = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  time -= dt;
  if (time <= 0) { time = 0; over = true; return; }
  spawn -= dt;
  if (spawn <= 0) {
    spawn = Math.max(0.4, 1.0 - score * 0.01);
    const free = holes.filter((h) => !h.active);
    if (free.length) {
      const h = free[Math.floor(Math.random() * free.length)];
      h.active = true; h.up = 0; h.dir = 1; h.bomb = Math.random() < 0.18; h.timer = 1.4;
    }
  }
  for (const h of holes) {
    if (!h.active) continue;
    h.up += h.dir * dt * 3;
    if (h.up >= 1) { h.up = 1; }
    h.timer -= dt;
    if (h.timer <= 0) { h.active = false; h.up = 0; }
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const h of holes) {
    ctx.fillStyle = "#161d2e";
    ctx.beginPath(); ctx.ellipse(h.x, h.y + h.r * 0.4, h.r, h.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    if (h.active && h.up > 0.05) {
      ctx.fillStyle = h.bomb ? "#222" : colors[2];
      ctx.beginPath();
      ctx.arc(h.x, h.y - h.r * (h.up - 0.4), h.r * 0.8, Math.PI, 0);
      ctx.fill();
      if (h.bomb) { ctx.fillStyle = colors[1]; ctx.fillRect(h.x - 3, h.y - h.r * (h.up - 0.4) - h.r * 0.9, 6, 8); }
    }
  }
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "left";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score, 20, 40);
  ctx.textAlign = "right";
  ctx.fillText("Time " + Math.ceil(time), WIDTH - 20, 40);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Time! — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const rct = canvas.getBoundingClientRect();
  const x = e.clientX - rct.left, y = e.clientY - rct.top;
  for (const h of holes) {
    if (h.active && h.up > 0.4 && Math.hypot(h.x - x, (h.y - h.r * (h.up - 0.4)) - y) < h.r * 0.85) {
      if (h.bomb) { over = true; }
      else { score += 1; h.active = false; h.up = 0; }
      return;
    }
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

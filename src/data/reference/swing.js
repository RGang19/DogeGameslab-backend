import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: rope-swing momentum runner (Spider / Swing style).
// Hold to fire a rope to the ceiling and swing; release to let go and fly.
// Travel as far as you can without hitting the ground spikes. R restarts.

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
const tuning = gamePackage?.gameplay?.tuning ?? {};
const GRAVITY = tuning.gravity ?? 1100;
const CEIL = 70;

let p, anchor, swinging, dist, over;

function reset() {
  p = { x: WIDTH * 0.3, y: HEIGHT * 0.5, vx: 180, vy: 0, r: 12 };
  anchor = null;
  swinging = false;
  dist = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  if (swinging && anchor) {
    // pendulum constraint
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const dx = p.x - anchor.x, dy = p.y - anchor.y;
    const len = Math.hypot(dx, dy);
    if (len > anchor.len) {
      const nx = dx / len, ny = dy / len;
      p.x = anchor.x + nx * anchor.len;
      p.y = anchor.y + ny * anchor.len;
      const dot = p.vx * nx + p.vy * ny;
      p.vx -= dot * nx;
      p.vy -= dot * ny;
    }
  } else {
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // keep player on screen horizontally; advance distance via world scroll
  const drift = p.x - WIDTH * 0.3;
  if (drift !== 0) {
    p.x -= drift;
    if (anchor) anchor.x -= drift;
    dist += Math.max(0, drift);
  }
  if (p.y + p.r > HEIGHT - 40) over = true;
  if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy) * 0.4; }
}

function fire() {
  if (over) { reset(); return; }
  anchor = { x: p.x + 120, y: CEIL, len: Math.hypot(120, p.y - CEIL) };
  swinging = true;
}
function release() { swinging = false; anchor = null; }

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#161d2e";
  ctx.fillRect(0, 0, WIDTH, CEIL);
  ctx.fillStyle = colors[1];
  for (let sx = 0; sx < WIDTH; sx += 28) {
    ctx.beginPath();
    ctx.moveTo(sx, HEIGHT); ctx.lineTo(sx + 14, HEIGHT - 30); ctx.lineTo(sx + 28, HEIGHT);
    ctx.fill();
  }
  if (swinging && anchor) {
    ctx.strokeStyle = "#eef6ff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = colors[0];
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = colors[2];
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(Math.floor(dist / 10) + "m", 24, CEIL + 36);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Splat — " + Math.floor(dist / 10) + "m", WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); fire(); });
window.addEventListener("pointerup", () => release());
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); fire(); }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") release(); });

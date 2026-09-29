import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Plinko / Pachinko drop board.
// Tap a column at the top to drop a ball. It bounces through the pegs into a
// multiplier slot. Build up your score. R resets.

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
const tuning = gamePackage?.gameplay?.tuning ?? {};
const GRAVITY = tuning.gravity ?? 700;
const ROWS = 10;
const SLOTS = [9, 4, 2, 1, 0.5, 0.3, 0.5, 1, 2, 4, 9];
let pegs, balls, score, top, slotW, pegGap;

function layout() {
  pegs = [];
  top = 90;
  pegGap = Math.min((WIDTH - 60) / (ROWS + 2), (HEIGHT - 200) / (ROWS + 1));
  for (let r = 0; r < ROWS; r++) {
    const count = r + 3;
    const rowW = (count - 1) * pegGap;
    for (let c = 0; c < count; c++) {
      pegs.push({ x: WIDTH / 2 - rowW / 2 + c * pegGap, y: top + r * pegGap, r: 5 });
    }
  }
  slotW = WIDTH / SLOTS.length;
}
function reset() { layout(); balls = []; score = 100; }
reset();

function drop(x) {
  if (score < 1) return;
  score -= 1;
  balls.push({ x, y: 40, vx: (Math.random() - 0.5) * 30, vy: 0, r: 8, done: false });
}

function update(dt) {
  for (const b of balls) {
    if (b.done) continue;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    for (const p of pegs) {
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
      if (d < b.r + p.r) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        b.x = p.x + nx * (b.r + p.r);
        b.y = p.y + ny * (b.r + p.r);
        const dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * 0.6 + (Math.random() - 0.5) * 40;
        b.vy = (b.vy - 2 * dot * ny) * 0.6;
      }
    }
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > WIDTH - b.r) { b.x = WIDTH - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y > HEIGHT - 50) {
      b.done = true;
      const slot = Math.max(0, Math.min(SLOTS.length - 1, Math.floor(b.x / slotW)));
      score += Math.round(SLOTS[slot] * 5);
      b.slot = slot; b.flash = 0.4;
    }
  }
  balls = balls.filter((b) => !b.done || (b.flash -= dt) > 0);
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff";
  for (const p of pegs) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < SLOTS.length; i++) {
    ctx.fillStyle = colors[i % colors.length] + "44";
    ctx.fillRect(i * slotW + 1, HEIGHT - 48, slotW - 2, 48);
    ctx.fillStyle = "#eef6ff"; ctx.font = "800 14px Inter"; ctx.textAlign = "center";
    ctx.fillText("x" + SLOTS[i], i * slotW + slotW / 2, HEIGHT - 20);
  }
  ctx.fillStyle = colors[2];
  for (const b of balls) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Credits " + score, 20, 40);
  ctx.font = "800 16px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Tap top to drop (−1 credit)", WIDTH / 2, 70);
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
  const r = canvas.getBoundingClientRect();
  drop(Math.max(12, Math.min(WIDTH - 12, e.clientX - r.left)));
});
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") reset();
  if (e.code === "Space") drop(WIDTH / 2 + (Math.random() - 0.5) * 40);
});

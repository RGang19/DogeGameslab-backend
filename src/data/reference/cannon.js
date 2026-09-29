import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: projectile knock-down (Angry Birds style).
// Drag back from the launcher to aim and set power, release to fire. Knock all
// the target blocks off their platform. Limited shots. R restarts.

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
const GRAVITY = tuning.gravity ?? 800;
let launcher, proj, blocks, shots, score, aim, won, over, platY;

function layout() { launcher = { x: 80, y: HEIGHT - 90 }; platY = HEIGHT - 60; }
function reset() {
  layout();
  blocks = [];
  const bx = WIDTH * 0.7;
  for (let i = 0; i < 5; i++) blocks.push({ x: bx + (i % 2) * 44, y: platY - 44 - Math.floor(i / 2) * 44, w: 40, h: 40, vx: 0, vy: 0, dead: false, onGround: true });
  proj = null; shots = 5; score = 0; aim = null; won = false; over = false;
}
reset();

function update(dt) {
  if (proj) {
    proj.vy += GRAVITY * dt;
    proj.x += proj.vx * dt; proj.y += proj.vy * dt;
    for (const b of blocks) {
      if (b.dead) continue;
      if (proj.x > b.x && proj.x < b.x + b.w && proj.y > b.y && proj.y < b.y + b.h) {
        b.vx += proj.vx * 0.04; b.vy -= 120; b.onGround = false;
        proj.vx *= 0.4; proj.vy *= 0.4; score += 50;
      }
    }
    if (proj.y > platY + 200 || proj.x > WIDTH + 60) { proj = null; if (shots <= 0) finish(); }
  }
  for (const b of blocks) {
    if (b.dead) continue;
    if (!b.onGround) {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.99;
      if (b.y + b.h > platY && b.x + b.w > WIDTH * 0.62) { b.y = platY - b.h; b.vy = 0; b.onGround = Math.abs(b.vx) < 20; }
      if (b.y > HEIGHT + 60 || b.x < WIDTH * 0.5) b.dead = true;
    }
  }
  if (blocks.every((b) => b.dead)) won = true;
}
function finish() { if (!won) over = true; }

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#16243f"; ctx.fillRect(0, platY, WIDTH, HEIGHT - platY);
  ctx.fillStyle = "#2b3a5c"; ctx.fillRect(launcher.x - 16, launcher.y, 32, platY - launcher.y);
  for (const b of blocks) { if (b.dead) continue; ctx.fillStyle = colors[0]; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = "#0a1020"; ctx.strokeRect(b.x, b.y, b.w, b.h); }
  if (proj) { ctx.fillStyle = colors[2]; ctx.beginPath(); ctx.arc(proj.x, proj.y, 12, 0, Math.PI * 2); ctx.fill(); }
  else if (!won && !over) { ctx.fillStyle = colors[2]; ctx.beginPath(); ctx.arc(launcher.x, launcher.y - 6, 12, 0, Math.PI * 2); ctx.fill(); }
  if (aim) {
    ctx.strokeStyle = "#eef6ff"; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(launcher.x, launcher.y - 6);
    ctx.lineTo(launcher.x + (launcher.x - aim.x), launcher.y - 6 + (launcher.y - aim.y)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Shots " + shots, 20, 36);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Cleared!" : "Out of shots", WIDTH / 2, HEIGHT / 2 - 10);
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

function at(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener("pointerdown", (e) => {
  if (won || over) { reset(); return; }
  if (proj || shots <= 0) return;
  aim = at(e);
});
canvas.addEventListener("pointermove", (e) => { if (aim) aim = at(e); });
window.addEventListener("pointerup", () => {
  if (!aim || proj) { aim = null; return; }
  proj = { x: launcher.x, y: launcher.y - 6, vx: (launcher.x - aim.x) * 3.5, vy: (launcher.y - aim.y) * 3.5 };
  shots -= 1; aim = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

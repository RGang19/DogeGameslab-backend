import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: draw-a-path physics (Draw Climber / line-rider lite).
// Draw ink platforms with the pointer; the rolling ball falls and rides them.
// Guide the ball into the goal. Limited ink. R restarts.

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
const GRAVITY = tuning.gravity ?? 900;
const INK_MAX = 1600;

let ball, segs, goal, ink, won, over, drawing, lastPt;

function reset() {
  ball = { x: WIDTH * 0.2, y: 80, vx: 0, vy: 0, r: 14 };
  segs = [];
  goal = { x: WIDTH * 0.82, y: HEIGHT * 0.8, r: 30 };
  ink = INK_MAX;
  won = false;
  over = false;
  drawing = false;
  lastPt = null;
}
reset();

function update(dt) {
  if (won || over) return;
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  for (const s of segs) {
    const closest = closestOnSeg(ball.x, ball.y, s);
    const d = Math.hypot(ball.x - closest.x, ball.y - closest.y);
    if (d < ball.r + 3) {
      const nx = (ball.x - closest.x) / (d || 1), ny = (ball.y - closest.y) / (d || 1);
      ball.x = closest.x + nx * (ball.r + 3);
      ball.y = closest.y + ny * (ball.r + 3);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= dot * nx * 1.4;
      ball.vy -= dot * ny * 1.4;
      ball.vx *= 0.98;
    }
  }
  if (Math.hypot(ball.x - goal.x, ball.y - goal.y) < goal.r + ball.r) won = true;
  if (ball.y > HEIGHT + 60 || ball.x < -60 || ball.x > WIDTH + 60) over = true;
}

function closestOnSeg(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / (dx * dx + dy * dy || 1)));
  return { x: s.x1 + t * dx, y: s.y1 + t * dy };
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const s of segs) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0a1020"; ctx.font = "800 16px Inter"; ctx.textAlign = "center";
  ctx.fillText("GOAL", goal.x, goal.y + 5);
  ctx.fillStyle = colors[2];
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#23304a";
  ctx.fillRect(24, 24, 200, 12);
  ctx.fillStyle = colors[0];
  ctx.fillRect(24, 24, 200 * ink / INK_MAX, 12);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "left"; ctx.font = "800 18px Inter, system-ui, sans-serif";
  ctx.fillText("Ink", 24, 56);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Solved!" : "Missed", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to restart", WIDTH / 2, HEIGHT / 2 + 28);
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
  drawing = true; lastPt = at(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drawing || ink <= 0) return;
  const p = at(e);
  const d = Math.hypot(p.x - lastPt.x, p.y - lastPt.y);
  if (d > 6) {
    if (ink - d > 0) { segs.push({ x1: lastPt.x, y1: lastPt.y, x2: p.x, y2: p.y }); ink -= d; lastPt = p; }
  }
});
window.addEventListener("pointerup", () => (drawing = false));
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: top-down mini-golf.
// Drag back from the ball and release to putt (slingshot power + aim). Sink it in
// the hole in as few strokes as possible. Walls bounce. R / next on sink.

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
let ball, hole, walls, strokes, level, aim, sunk;

function layout() {
  walls = [
    { x: WIDTH * 0.4, y: HEIGHT * 0.2, w: 24, h: HEIGHT * 0.4 },
    { x: WIDTH * 0.6, y: HEIGHT * 0.5, w: 24, h: HEIGHT * 0.35 }
  ];
}
function start() {
  layout();
  ball = { x: WIDTH * 0.18, y: HEIGHT * 0.78, vx: 0, vy: 0, r: 11 };
  hole = { x: WIDTH * 0.82, y: HEIGHT * 0.24, r: 17 };
  strokes = 0; aim = null; sunk = false;
}
function reset() { level = 1; start(); }
reset();

function moving() { return Math.hypot(ball.vx, ball.vy) > 6; }

function update(dt) {
  if (sunk) return;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  ball.vx *= 0.98; ball.vy *= 0.98;
  if (Math.hypot(ball.vx, ball.vy) < 6) { ball.vx = ball.vy = 0; }
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = -ball.vx * 0.7; }
  if (ball.x > WIDTH - ball.r) { ball.x = WIDTH - ball.r; ball.vx = -ball.vx * 0.7; }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = -ball.vy * 0.7; }
  if (ball.y > HEIGHT - ball.r) { ball.y = HEIGHT - ball.r; ball.vy = -ball.vy * 0.7; }
  for (const w of walls) {
    if (ball.x + ball.r > w.x && ball.x - ball.r < w.x + w.w && ball.y + ball.r > w.y && ball.y - ball.r < w.y + w.h) {
      const overL = ball.x + ball.r - w.x, overR = w.x + w.w - (ball.x - ball.r);
      const overT = ball.y + ball.r - w.y, overB = w.y + w.h - (ball.y - ball.r);
      const m = Math.min(overL, overR, overT, overB);
      if (m === overL) { ball.x = w.x - ball.r; ball.vx = -Math.abs(ball.vx) * 0.7; }
      else if (m === overR) { ball.x = w.x + w.w + ball.r; ball.vx = Math.abs(ball.vx) * 0.7; }
      else if (m === overT) { ball.y = w.y - ball.r; ball.vy = -Math.abs(ball.vy) * 0.7; }
      else { ball.y = w.y + w.h + ball.r; ball.vy = Math.abs(ball.vy) * 0.7; }
    }
  }
  if (Math.hypot(ball.x - hole.x, ball.y - hole.y) < hole.r - 2 && Math.hypot(ball.vx, ball.vy) < 280) sunk = true;
}

function render() {
  ctx.fillStyle = "#0c3a22";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#0a2a18";
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = "#04130b";
  ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[1]; ctx.fillRect(hole.x - 1, hole.y - 40, 3, 40);
  ctx.beginPath(); ctx.moveTo(hole.x + 2, hole.y - 40); ctx.lineTo(hole.x + 22, hole.y - 32); ctx.lineTo(hole.x + 2, hole.y - 24); ctx.fill();
  ctx.fillStyle = "#f4f7ff";
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  if (aim && !moving()) {
    ctx.strokeStyle = "#eef6ff"; ctx.lineWidth = 3; ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + (ball.x - aim.x), ball.y + (ball.y - aim.y)); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Hole " + level + "   Strokes " + strokes, 20, 36);
  if (sunk) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("In! " + strokes + " strokes", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Tap for next hole", WIDTH / 2, HEIGHT / 2 + 28);
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
  if (sunk) { level += 1; start(); return; }
  if (moving()) return;
  const p = at(e);
  if (Math.hypot(p.x - ball.x, p.y - ball.y) < 70) aim = p;
});
canvas.addEventListener("pointermove", (e) => { if (aim) aim = at(e); });
window.addEventListener("pointerup", () => {
  if (!aim || moving()) { aim = null; return; }
  ball.vx = (ball.x - aim.x) * 4;
  ball.vy = (ball.y - aim.y) * 4;
  strokes += 1; aim = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

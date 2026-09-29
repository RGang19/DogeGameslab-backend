import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: pinball table with two flippers and bumpers.
// Left side / Left arrow = left flipper, right side / Right arrow = right flipper.
// Hold Space to charge the plunger, release to launch. R resets.

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
const GRAVITY = tuning.gravity ?? 900;
let ball, bumpers, leftUp, rightUp, score, balls, charge, charging, launched;
let lf, rf;

function layout() {
  bumpers = [
    { x: WIDTH * 0.35, y: HEIGHT * 0.3, r: 26 },
    { x: WIDTH * 0.6, y: HEIGHT * 0.25, r: 26 },
    { x: WIDTH * 0.5, y: HEIGHT * 0.45, r: 30 }
  ];
  lf = { x: WIDTH * 0.32, y: HEIGHT - 80, len: WIDTH * 0.16, ang: 0.35 };
  rf = { x: WIDTH * 0.68, y: HEIGHT - 80, len: WIDTH * 0.16, ang: 0.35 };
}
function newBall() {
  ball = { x: WIDTH - 24, y: HEIGHT - 60, vx: 0, vy: 0, r: 11 };
  launched = false;
  charge = 0;
}
function reset() { layout(); score = 0; balls = 3; leftUp = rightUp = false; newBall(); }
reset();

function flipperHit(f, up, sign) {
  // flipper as a line from pivot; approximate with a tilted segment
  const a = up ? -0.9 * sign : 0.35 * sign;
  const ex = f.x + Math.cos(a) * f.len * sign;
  const ey = f.y - Math.abs(Math.sin(a)) * f.len;
  const seg = { x1: f.x, y1: f.y, x2: ex, y2: ey };
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const t = Math.max(0, Math.min(1, ((ball.x - seg.x1) * dx + (ball.y - seg.y1) * dy) / (dx * dx + dy * dy || 1)));
  const cx = seg.x1 + t * dx, cy = seg.y1 + t * dy;
  const d = Math.hypot(ball.x - cx, ball.y - cy);
  if (d < ball.r + 8) {
    const nx = (ball.x - cx) / (d || 1), ny = (ball.y - cy) / (d || 1);
    ball.x = cx + nx * (ball.r + 8);
    ball.y = cy + ny * (ball.r + 8);
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
    if (up) { ball.vy -= 360; ball.vx += sign * 80; }
    ball.vx *= 0.9; ball.vy *= 0.9;
  }
  return { ex, ey };
}

function update(dt) {
  if (!launched) {
    if (charging) charge = Math.min(1, charge + dt);
    return;
  }
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.8; }
  if (ball.x > WIDTH - ball.r) { ball.x = WIDTH - ball.r; ball.vx = -Math.abs(ball.vx) * 0.8; }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.8; }
  for (const b of bumpers) {
    const d = Math.hypot(ball.x - b.x, ball.y - b.y);
    if (d < ball.r + b.r) {
      const nx = (ball.x - b.x) / (d || 1), ny = (ball.y - b.y) / (d || 1);
      ball.x = b.x + nx * (ball.r + b.r);
      ball.y = b.y + ny * (ball.r + b.r);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 0.9 + nx * 120;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.9 + ny * 120;
      score += 100;
    }
  }
  flipperHit(lf, leftUp, 1);
  flipperHit(rf, rightUp, -1);
  if (ball.y > HEIGHT + 30) {
    balls -= 1;
    if (balls <= 0) { /* stay for restart */ }
    else newBall();
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const b of bumpers) { ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  const le = flipperHit(lf, leftUp, 1), re = flipperHit(rf, rightUp, -1);
  ctx.strokeStyle = colors[2]; ctx.lineWidth = 10; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(lf.x, lf.y); ctx.lineTo(le.ex, le.ey);
  ctx.moveTo(rf.x, rf.y); ctx.lineTo(re.ex, re.ey); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#eef6ff";
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Balls " + balls, 20, 36);
  if (!launched) {
    ctx.fillStyle = colors[1];
    ctx.fillRect(WIDTH - 34, HEIGHT - 60 + (1 - charge) * 0, 20, charge * 80);
    ctx.fillStyle = "#9fb0d0"; ctx.font = "800 16px Inter"; ctx.textAlign = "center";
    ctx.fillText("Hold Space / tap to launch", WIDTH / 2, HEIGHT - 20);
  }
  if (balls <= 0) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

function launch() {
  if (balls <= 0) { reset(); return; }
  if (!launched) { ball.vy = -300 - charge * 700; ball.vx = -40; launched = true; charging = false; }
}
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") leftUp = true;
  if (e.code === "ArrowRight") rightUp = true;
  if (e.code === "Space") charging = true;
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") leftUp = false;
  if (e.code === "ArrowRight") rightUp = false;
  if (e.code === "Space") launch();
});
canvas.addEventListener("pointerdown", (e) => {
  if (balls <= 0) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  if (!launched) { charging = true; return; }
  if (e.clientX - r.left < WIDTH / 2) leftUp = true; else rightUp = true;
});
canvas.addEventListener("pointerup", () => {
  if (!launched) launch();
  leftUp = rightUp = false;
});

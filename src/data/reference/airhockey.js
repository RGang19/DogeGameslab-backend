import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: air hockey vs AI.
// Drag your mallet (bottom half) to hit the puck into the top goal. First to 7
// wins. R restarts.

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
const WIN = 7;
let puck, me, ai, scoreMe, scoreAI, over, mePrev;

function reset() {
  puck = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, r: 16 };
  me = { x: WIDTH / 2, y: HEIGHT - 80, r: 30 };
  ai = { x: WIDTH / 2, y: 80, r: 30 };
  mePrev = { x: me.x, y: me.y };
  scoreMe = 0; scoreAI = 0;
  over = false;
}
reset();

function serve(dir) { puck.x = WIDTH / 2; puck.y = HEIGHT / 2; puck.vx = 0; puck.vy = 200 * dir; }

function collide(m, vx, vy) {
  const dx = puck.x - m.x, dy = puck.y - m.y, d = Math.hypot(dx, dy);
  if (d < puck.r + m.r) {
    const nx = dx / (d || 1), ny = dy / (d || 1);
    puck.x = m.x + nx * (puck.r + m.r);
    puck.y = m.y + ny * (puck.r + m.r);
    const sp = Math.max(280, Math.hypot(puck.vx, puck.vy));
    puck.vx = nx * sp + vx * 0.6;
    puck.vy = ny * sp + vy * 0.6;
  }
}

function update(dt) {
  if (over) return;
  // ai chases puck on its half
  const tx = puck.y < HEIGHT / 2 ? puck.x : WIDTH / 2;
  ai.x += (tx - ai.x) * Math.min(1, 4 * dt);
  ai.y += ((puck.y < HEIGHT / 2 ? Math.min(puck.y, HEIGHT / 2 - 40) : 80) - ai.y) * Math.min(1, 4 * dt);
  ai.x = Math.max(ai.r, Math.min(WIDTH - ai.r, ai.x));
  puck.x += puck.vx * dt; puck.y += puck.vy * dt;
  puck.vx *= 0.995; puck.vy *= 0.995;
  if (puck.x < puck.r) { puck.x = puck.r; puck.vx = Math.abs(puck.vx); }
  if (puck.x > WIDTH - puck.r) { puck.x = WIDTH - puck.r; puck.vx = -Math.abs(puck.vx); }
  const goalW = WIDTH * 0.32;
  if (puck.y < puck.r) {
    if (Math.abs(puck.x - WIDTH / 2) < goalW / 2) { scoreMe++; if (scoreMe >= WIN) over = true; else serve(1); }
    else { puck.y = puck.r; puck.vy = Math.abs(puck.vy); }
  }
  if (puck.y > HEIGHT - puck.r) {
    if (Math.abs(puck.x - WIDTH / 2) < goalW / 2) { scoreAI++; if (scoreAI >= WIN) over = true; else serve(-1); }
    else { puck.y = HEIGHT - puck.r; puck.vy = -Math.abs(puck.vy); }
  }
  const mvx = (me.x - mePrev.x) / dt, mvy = (me.y - mePrev.y) / dt;
  collide(me, mvx, mvy);
  collide(ai, 0, 0);
  mePrev = { x: me.x, y: me.y };
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#23304a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, HEIGHT / 2); ctx.lineTo(WIDTH, HEIGHT / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 50, 0, Math.PI * 2); ctx.stroke();
  const goalW = WIDTH * 0.32;
  ctx.strokeStyle = colors[2]; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(WIDTH / 2 - goalW / 2, 3); ctx.lineTo(WIDTH / 2 + goalW / 2, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(WIDTH / 2 - goalW / 2, HEIGHT - 3); ctx.lineTo(WIDTH / 2 + goalW / 2, HEIGHT - 3); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.arc(ai.x, ai.y, ai.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(me.x, me.y, me.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff"; ctx.beginPath(); ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2); ctx.fill();
  ctx.font = "800 40px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = "#33405e";
  ctx.fillText(scoreAI + " : " + scoreMe, WIDTH / 2, HEIGHT / 2 + 14);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(scoreMe >= WIN ? "You win!" : "AI wins", WIDTH / 2, HEIGHT / 2 - 10);
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

function moveMallet(e) {
  const r = canvas.getBoundingClientRect();
  me.x = Math.max(me.r, Math.min(WIDTH - me.r, e.clientX - r.left));
  me.y = Math.max(HEIGHT / 2 + me.r, Math.min(HEIGHT - me.r, e.clientY - r.top));
}
let dragging = false;
canvas.addEventListener("pointerdown", (e) => { if (over) { reset(); return; } dragging = true; moveMallet(e); });
canvas.addEventListener("pointermove", (e) => { if (dragging) moveMallet(e); });
window.addEventListener("pointerup", () => (dragging = false));
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

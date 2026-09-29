import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: swipe-to-slice arcade (Fruit Ninja style).
// Drag across flying fruit to slice it. Slicing a bomb ends the game. Missing
// three fruit ends the game. R restarts.

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

let fruit, trail, spawn, score, missed, over;

function reset() {
  fruit = [];
  trail = [];
  spawn = 0;
  score = 0;
  missed = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  spawn -= dt;
  if (spawn <= 0) {
    spawn = 0.7 + Math.random() * 0.6;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const bomb = Math.random() < 0.16;
      fruit.push({
        x: 80 + Math.random() * (WIDTH - 160),
        y: HEIGHT + 30,
        vx: (Math.random() - 0.5) * 160,
        vy: -(700 + Math.random() * 260),
        r: 26, bomb, sliced: false,
        c: bomb ? "#222" : colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }
  for (const f of fruit) {
    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
  for (const f of fruit) {
    if (!f.sliced && f.y - f.r > HEIGHT && f.vy > 0) {
      f.gone = true;
      if (!f.bomb) { missed += 1; if (missed >= 3) over = true; }
    }
  }
  fruit = fruit.filter((f) => !f.gone && !f.sliced);
  trail = trail.filter((t) => (t.life -= dt) > 0);
}

function slice(x, y) {
  for (const f of fruit) {
    if (!f.sliced && Math.hypot(f.x - x, f.y - y) < f.r + 8) {
      if (f.bomb) { over = true; }
      else { f.sliced = true; score += 1; }
    }
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const f of fruit) {
    ctx.fillStyle = f.c;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    if (f.bomb) { ctx.fillStyle = colors[1]; ctx.fillRect(f.x - 3, f.y - f.r - 8, 6, 10); }
  }
  ctx.strokeStyle = "#eef6ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 1; i < trail.length; i++) { ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score " + score + "   Miss " + missed + "/3", 24, 38);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 10);
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

let down = false;
function at(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  down = true; const p = at(e); trail.push({ ...p, life: 0.3 }); slice(p.x, p.y);
});
canvas.addEventListener("pointermove", (e) => {
  if (!down) return; const p = at(e); trail.push({ ...p, life: 0.3 }); slice(p.x, p.y);
});
window.addEventListener("pointerup", () => (down = false));
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: cut-the-rope physics puzzle.
// Swipe across a rope to cut it. The candy swings and falls under gravity — drop
// it into the mouth to win. R restarts.

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
const GRAVITY = tuning.gravity ?? 1400;
let ropes, candy, mouth, won, over, stars, got;

function layout() {
  mouth = { x: WIDTH * 0.5, y: HEIGHT * 0.82, r: 34 };
}
function reset() {
  layout();
  candy = { x: WIDTH * 0.3, y: HEIGHT * 0.3, px: WIDTH * 0.3, py: HEIGHT * 0.3 - 1, r: 16 };
  ropes = [
    { ax: WIDTH * 0.3, ay: HEIGHT * 0.12, len: HEIGHT * 0.2, cut: false },
    { ax: WIDTH * 0.62, ay: HEIGHT * 0.2, len: HEIGHT * 0.32, cut: false }
  ];
  stars = [{ x: WIDTH * 0.5, y: HEIGHT * 0.5, got: false }];
  got = 0;
  won = false; over = false;
}
reset();

function verlet(dt) {
  const vx = (candy.x - candy.px) * 0.99, vy = (candy.y - candy.py) * 0.99;
  candy.px = candy.x; candy.py = candy.y;
  candy.x += vx; candy.y += vy + GRAVITY * dt * dt;
}
function constrain() {
  for (const rp of ropes) {
    if (rp.cut) continue;
    const dx = candy.x - rp.ax, dy = candy.y - rp.ay, d = Math.hypot(dx, dy);
    if (d > rp.len) {
      const f = (d - rp.len) / d;
      candy.x -= dx * f; candy.y -= dy * f;
    }
  }
}

function update(dt) {
  if (won || over) return;
  verlet(dt);
  constrain();
  if (candy.x < candy.r) { candy.x = candy.r; candy.px = candy.x + 2; }
  if (candy.x > WIDTH - candy.r) { candy.x = WIDTH - candy.r; candy.px = candy.x - 2; }
  for (const s of stars) if (!s.got && Math.hypot(s.x - candy.x, s.y - candy.y) < s.r ? false : Math.hypot(s.x - candy.x, s.y - candy.y) < 22) { s.got = true; got++; }
  if (Math.hypot(candy.x - mouth.x, candy.y - mouth.y) < mouth.r) won = true;
  if (candy.y > HEIGHT + 40) over = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const rp of ropes) {
    ctx.fillStyle = "#6a7aa0";
    ctx.beginPath(); ctx.arc(rp.ax, rp.ay, 6, 0, Math.PI * 2); ctx.fill();
    if (!rp.cut) {
      const d = Math.hypot(candy.x - rp.ax, candy.y - rp.ay);
      if (d <= rp.len + 4) {
        ctx.strokeStyle = "#b98a4a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(rp.ax, rp.ay); ctx.lineTo(candy.x, candy.y); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }
  for (const s of stars) if (!s.got) { ctx.fillStyle = colors[2]; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(mouth.x, mouth.y, mouth.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0a1020"; ctx.beginPath(); ctx.arc(mouth.x, mouth.y, mouth.r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[0];
  ctx.beginPath(); ctx.arc(candy.x, candy.y, candy.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("Stars " + got + "/" + stars.length + "   (swipe to cut rope)", 20, 36);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Nom! " + got + " stars" : "Missed", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.032, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function segCut(x1, y1, x2, y2) {
  for (const rp of ropes) {
    if (rp.cut) continue;
    // approximate rope as segment anchor->candy
    const d = ptSeg(rp.ax, rp.ay, candy.x, candy.y, x1, y1) + ptSeg(rp.ax, rp.ay, candy.x, candy.y, x2, y2);
    if (ptSeg(rp.ax, rp.ay, candy.x, candy.y, x2, y2) < 16) rp.cut = true;
  }
}
function ptSeg(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
let prev = null;
function at(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener("pointerdown", (e) => {
  if (won || over) { reset(); return; }
  prev = at(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (!prev) return;
  const p = at(e);
  segCut(prev.x, prev.y, p.x, p.y);
  prev = p;
});
window.addEventListener("pointerup", () => (prev = null));
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

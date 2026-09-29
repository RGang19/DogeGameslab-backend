import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: .io eat-to-grow arena (Agar.io style).
// Move toward the pointer. Eat pellets and smaller blobs to grow; avoid bigger
// ones. R restarts.

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
const WORLD = 2400;
let me, pellets, bots, target, over;

function reset() {
  me = { x: WORLD / 2, y: WORLD / 2, r: 18 };
  pellets = [];
  bots = [];
  target = { x: me.x, y: me.y };
  over = false;
  for (let i = 0; i < 260; i++) pellets.push(rndPellet());
  for (let i = 0; i < 14; i++) bots.push(rndBot());
}
function rndPellet() { return { x: Math.random() * WORLD, y: Math.random() * WORLD, r: 6, c: colors[Math.floor(Math.random() * colors.length)] }; }
function rndBot() {
  return { x: Math.random() * WORLD, y: Math.random() * WORLD, r: 12 + Math.random() * 28, vx: 0, vy: 0, c: colors[Math.floor(Math.random() * colors.length)], t: 0 };
}
reset();

function update(dt) {
  if (over) return;
  const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy) || 1;
  const sp = 160 / (1 + me.r / 60);
  me.x += (dx / d) * Math.min(sp, d) * dt * 3;
  me.y += (dy / d) * Math.min(sp, d) * dt * 3;
  me.x = Math.max(me.r, Math.min(WORLD - me.r, me.x));
  me.y = Math.max(me.r, Math.min(WORLD - me.r, me.y));
  for (const p of pellets) {
    if (Math.hypot(p.x - me.x, p.y - me.y) < me.r) { p.x = Math.random() * WORLD; p.y = Math.random() * WORLD; me.r += 0.6; }
  }
  for (const b of bots) {
    b.t -= dt;
    if (b.t <= 0) { b.t = 1 + Math.random() * 2; b.vx = (Math.random() - 0.5) * 90; b.vy = (Math.random() - 0.5) * 90; }
    b.x = Math.max(b.r, Math.min(WORLD - b.r, b.x + b.vx * dt));
    b.y = Math.max(b.r, Math.min(WORLD - b.r, b.y + b.vy * dt));
    const dd = Math.hypot(b.x - me.x, b.y - me.y);
    if (dd < me.r && me.r > b.r + 2) { me.r += b.r * 0.25; Object.assign(b, rndBot()); }
    else if (dd < b.r && b.r > me.r + 2) over = true;
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const camX = me.x - WIDTH / 2, camY = me.y - HEIGHT / 2;
  ctx.strokeStyle = "#141b2c";
  for (let gx = 0; gx <= WORLD; gx += 80) { ctx.beginPath(); ctx.moveTo(gx - camX, -camY); ctx.lineTo(gx - camX, WORLD - camY); ctx.stroke(); }
  for (let gy = 0; gy <= WORLD; gy += 80) { ctx.beginPath(); ctx.moveTo(-camX, gy - camY); ctx.lineTo(WORLD - camX, gy - camY); ctx.stroke(); }
  for (const p of pellets) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2); ctx.fill(); }
  for (const b of bots) { ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x - camX, b.y - camY, b.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef6ff";
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, me.r, 0, Math.PI * 2); ctx.fill();
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Mass " + Math.floor(me.r), 24, 38);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Eaten!", WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  target.x = me.x + (e.clientX - r.left - WIDTH / 2);
  target.y = me.y + (e.clientY - r.top - HEIGHT / 2);
});
canvas.addEventListener("pointerdown", () => { if (over) reset(); });
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

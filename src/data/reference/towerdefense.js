import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: tower defense (Bloons style).
// Click an empty cell to build a tower (costs gold). Towers auto-shoot creeps
// that follow the path. Don't let creeps reach the exit. R restarts.

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
const COST = tuning.cost ?? 50;

const path = [
  { x: 0, y: 0.25 }, { x: 0.4, y: 0.25 }, { x: 0.4, y: 0.7 },
  { x: 0.75, y: 0.7 }, { x: 0.75, y: 0.35 }, { x: 1, y: 0.35 }
];
let towers, creeps, shots, gold, lives, wave, spawnT, toSpawn, over, win;

function reset() {
  towers = [];
  creeps = [];
  shots = [];
  gold = 120;
  lives = 10;
  wave = 1;
  toSpawn = 6;
  spawnT = 0;
  over = false;
  win = false;
}
reset();

function pt(i) { return { x: path[i].x * WIDTH, y: path[i].y * HEIGHT }; }
function onPath(x, y) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = pt(i), b = pt(i + 1);
    const d = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < 40) return true;
  }
  return false;
}
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function update(dt) {
  if (over || win) return;
  spawnT -= dt;
  if (toSpawn > 0 && spawnT <= 0) {
    spawnT = 0.8;
    toSpawn -= 1;
    creeps.push({ seg: 0, t: 0, hp: 3 + wave, max: 3 + wave });
  }
  for (const c of creeps) {
    const a = pt(c.seg), b = pt(c.seg + 1);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    c.t += (60 + wave * 6) * dt / len;
    if (c.t >= 1) { c.t = 0; c.seg += 1; if (c.seg >= path.length - 1) { c.dead = "exit"; } }
    c.x = a.x + (b.x - a.x) * c.t;
    c.y = a.y + (b.y - a.y) * c.t;
  }
  for (const t of towers) {
    t.cd -= dt;
    if (t.cd <= 0) {
      const target = creeps.find((c) => !c.dead && Math.hypot(c.x - t.x, c.y - t.y) < 140);
      if (target) {
        t.cd = 0.6;
        shots.push({ x: t.x, y: t.y, target });
      }
    }
  }
  for (const s of shots) {
    if (!s.target || s.target.dead) { s.dead = true; continue; }
    const dx = s.target.x - s.x, dy = s.target.y - s.y, d = Math.hypot(dx, dy);
    if (d < 10) { s.target.hp -= 1; s.dead = true; if (s.target.hp <= 0) s.target.dead = "kill"; }
    else { s.x += (dx / d) * 420 * dt; s.y += (dy / d) * 420 * dt; }
  }
  for (const c of creeps) {
    if (c.dead === "kill") gold += 8;
    if (c.dead === "exit") lives -= 1;
  }
  creeps = creeps.filter((c) => !c.dead);
  shots = shots.filter((s) => !s.dead);
  if (lives <= 0) over = true;
  if (toSpawn === 0 && creeps.length === 0) {
    if (wave >= 8) win = true;
    else { wave += 1; toSpawn = 6 + wave; gold += 30; }
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#1c2740";
  ctx.lineWidth = 64;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pt(0).x, pt(0).y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(pt(i).x, pt(i).y);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const t of towers) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(t.x - 16, t.y - 16, 32, 32);
  }
  for (const c of creeps) {
    ctx.fillStyle = colors[1];
    ctx.beginPath(); ctx.arc(c.x, c.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a1020"; ctx.fillRect(c.x - 13, c.y - 22, 26, 4);
    ctx.fillStyle = colors[2]; ctx.fillRect(c.x - 13, c.y - 22, 26 * (c.hp / c.max), 4);
  }
  ctx.fillStyle = colors[2];
  for (const s of shots) { ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Gold ${gold}   Lives ${lives}   Wave ${wave}`, 20, 32);
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Defended!" : "Overrun", WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointerdown", (e) => {
  if (over || win) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (gold < COST || onPath(x, y)) return;
  if (towers.some((t) => Math.hypot(t.x - x, t.y - y) < 36)) return;
  towers.push({ x, y, cd: 0 });
  gold -= COST;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });

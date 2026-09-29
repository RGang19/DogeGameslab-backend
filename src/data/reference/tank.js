import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: top-down tank duel.
// WASD to drive, aim with the pointer, click / Space to fire. Destroy the enemy
// tank while dodging its shells and using cover. R restarts.

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
const keys = {};
let me, foe, shells, walls, mouse, score, over, win, foeCd, myCd;

function reset() {
  me = { x: WIDTH * 0.2, y: HEIGHT * 0.5, a: 0, hp: 5 };
  foe = { x: WIDTH * 0.8, y: HEIGHT * 0.5, a: Math.PI, hp: 5, t: 0 };
  shells = [];
  walls = [
    { x: WIDTH * 0.45, y: HEIGHT * 0.2, w: 30, h: HEIGHT * 0.25 },
    { x: WIDTH * 0.45, y: HEIGHT * 0.55, w: 30, h: HEIGHT * 0.25 },
    { x: WIDTH * 0.3, y: HEIGHT * 0.45, w: 120, h: 28 }
  ];
  mouse = { x: WIDTH * 0.6, y: HEIGHT * 0.5 };
  over = false; win = false; foeCd = 1.4; myCd = 0;
}
reset();

function blocked(x, y) {
  for (const w of walls) if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
  return x < 16 || x > WIDTH - 16 || y < 16 || y > HEIGHT - 16;
}
function fire(t, tx, ty) {
  const a = Math.atan2(ty - t.y, tx - t.x);
  shells.push({ x: t.x + Math.cos(a) * 26, y: t.y + Math.sin(a) * 26, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, own: t === me });
}

function update(dt) {
  if (over || win) return;
  const sp = 150;
  let nx = me.x, ny = me.y;
  if (keys["w"]) ny -= sp * dt; if (keys["s"]) ny += sp * dt;
  if (keys["a"]) nx -= sp * dt; if (keys["d"]) nx += sp * dt;
  if (!blocked(nx, me.y)) me.x = nx;
  if (!blocked(me.x, ny)) me.y = ny;
  me.a = Math.atan2(mouse.y - me.y, mouse.x - me.x);
  myCd -= dt;
  if (keys["fire"] && myCd <= 0) { fire(me, mouse.x, mouse.y); myCd = 0.6; }
  // foe AI
  foe.t += dt;
  const fa = Math.atan2(me.y - foe.y, me.x - foe.x);
  foe.a = fa;
  const fnx = foe.x + Math.cos(fa + Math.sin(foe.t) * 0.6) * 60 * dt;
  const fny = foe.y + Math.sin(fa + Math.sin(foe.t) * 0.6) * 60 * dt;
  if (!blocked(fnx, foe.y)) foe.x = fnx;
  if (!blocked(foe.x, fny)) foe.y = fny;
  foeCd -= dt;
  if (foeCd <= 0) { fire(foe, me.x, me.y); foeCd = 1.2; }
  for (const s of shells) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (blocked(s.x, s.y)) s.dead = true;
    if (s.own && Math.hypot(s.x - foe.x, s.y - foe.y) < 18) { s.dead = true; foe.hp -= 1; }
    if (!s.own && Math.hypot(s.x - me.x, s.y - me.y) < 18) { s.dead = true; me.hp -= 1; }
  }
  shells = shells.filter((s) => !s.dead);
  if (foe.hp <= 0) win = true;
  if (me.hp <= 0) over = true;
}

function drawTank(t, col) {
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
  ctx.fillStyle = col; ctx.fillRect(-16, -14, 32, 28);
  ctx.fillStyle = "#0a1020"; ctx.fillRect(0, -4, 26, 8);
  ctx.restore();
}
function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#2b3a5c";
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  drawTank(me, colors[0]);
  drawTank(foe, colors[1]);
  ctx.fillStyle = colors[2];
  for (const s of shells) { ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("You " + Math.max(0, me.hp) + "   Enemy " + Math.max(0, foe.hp), 20, 34);
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Enemy destroyed!" : "You were hit", WIDTH / 2, HEIGHT / 2 - 10);
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

const km = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", ArrowUp: "w", ArrowLeft: "a", ArrowDown: "s", ArrowRight: "d", Space: "fire" };
window.addEventListener("keydown", (e) => { if (km[e.code]) { e.preventDefault(); keys[km[e.code]] = true; } if (e.code === "KeyR") reset(); });
window.addEventListener("keyup", (e) => { if (km[e.code]) keys[km[e.code]] = false; });
canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
canvas.addEventListener("pointerdown", (e) => {
  if (over || win) { reset(); return; }
  const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  keys["fire"] = true;
});
canvas.addEventListener("pointerup", () => (keys["fire"] = false));

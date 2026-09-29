import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: 1v1 brawler with health bars.
// Player: A/D move, W jump, F punch. Fight the AI. First to drain HP wins. R restarts.

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
const GRAVITY = tuning.gravity ?? 2000;
const FLOOR = () => HEIGHT - 90;

const keys = {};
let p1, p2, over, winner;

function mk(x, face) {
  return { x, y: FLOOR() - 90, vy: 0, w: 50, h: 90, hp: 100, face, atk: 0, hurt: 0, onGround: true };
}
function reset() {
  p1 = mk(WIDTH * 0.3, 1);
  p2 = mk(WIDTH * 0.7, -1);
  over = false;
  winner = "";
}
reset();

function physics(f, dt) {
  f.vy += GRAVITY * dt;
  f.y += f.vy * dt;
  if (f.y > FLOOR() - f.h) { f.y = FLOOR() - f.h; f.vy = 0; f.onGround = true; }
  if (f.atk > 0) f.atk -= dt;
  if (f.hurt > 0) f.hurt -= dt;
  f.x = Math.max(20, Math.min(WIDTH - 20 - f.w, f.x));
}

function punch(att, def) {
  if (att.atk > 0.2 && def.hurt <= 0) {
    const reach = att.face === 1 ? att.x + att.w + 30 : att.x - 30;
    if (Math.abs((def.x + def.w / 2) - reach) < 50 && Math.abs(def.y - att.y) < 60) {
      def.hp -= 8;
      def.hurt = 0.4;
      def.x += att.face * 24;
    }
  }
}

function update(dt) {
  if (over) return;
  if (keys["a"]) { p1.x -= 240 * dt; p1.face = -1; }
  if (keys["d"]) { p1.x += 240 * dt; p1.face = 1; }
  if (keys["w"] && p1.onGround) { p1.vy = -740; p1.onGround = false; }
  if (keys["f"] && p1.atk <= 0) p1.atk = 0.3;
  p1.face = p2.x > p1.x ? 1 : -1;
  // simple AI
  const dx = p1.x - p2.x;
  p2.face = dx > 0 ? 1 : -1;
  if (Math.abs(dx) > 70) p2.x += Math.sign(dx) * 160 * dt;
  else if (p2.atk <= 0 && Math.random() < 0.03) p2.atk = 0.3;
  if (p2.onGround && Math.random() < 0.01) { p2.vy = -700; p2.onGround = false; }
  physics(p1, dt);
  physics(p2, dt);
  punch(p1, p2);
  punch(p2, p1);
  if (p1.hp <= 0) { over = true; winner = "AI wins"; }
  if (p2.hp <= 0) { over = true; winner = "You win!"; }
}

function drawFighter(f, c) {
  ctx.fillStyle = f.hurt > 0 ? "#ff6b6b" : c;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(f.x + (f.face === 1 ? f.w - 14 : 4), f.y + 14, 10, 10);
  if (f.atk > 0.1) {
    ctx.fillStyle = colors[2];
    const ax = f.face === 1 ? f.x + f.w : f.x - 26;
    ctx.fillRect(ax, f.y + 26, 26, 16);
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#161d2e";
  ctx.fillRect(0, FLOOR(), WIDTH, HEIGHT - FLOOR());
  drawFighter(p1, colors[0]);
  drawFighter(p2, colors[1]);
  ctx.fillStyle = "#23304a";
  ctx.fillRect(20, 24, 260, 18); ctx.fillRect(WIDTH - 280, 24, 260, 18);
  ctx.fillStyle = colors[0]; ctx.fillRect(20, 24, 260 * Math.max(0, p1.hp) / 100, 18);
  ctx.fillStyle = colors[1]; ctx.fillRect(WIDTH - 20 - 260 * Math.max(0, p2.hp) / 100, 24, 260 * Math.max(0, p2.hp) / 100, 18);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(winner, WIDTH / 2, HEIGHT / 2 - 10);
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

const map = { KeyA: "a", KeyD: "d", KeyW: "w", KeyF: "f", ArrowLeft: "a", ArrowRight: "d", ArrowUp: "w", Space: "f" };
window.addEventListener("keydown", (e) => {
  if (map[e.code]) { e.preventDefault(); keys[map[e.code]] = true; }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => { if (map[e.code]) keys[map[e.code]] = false; });
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  if (x < WIDTH * 0.35) keys["a"] = true;
  else if (x > WIDTH * 0.65) keys["d"] = true;
  else keys["f"] = true;
});
canvas.addEventListener("pointerup", () => { keys["a"] = keys["d"] = keys["f"] = false; });

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: hold-to-fly horizontal scroller (Jetpack Joyride style).
// Hold tap / Space to thrust up, release to fall. Dodge zappers, grab coins. R restarts.

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
const GRAVITY = tuning.gravity ?? 1400;
const THRUST = tuning.jump ?? -2200;
const SPEED = tuning.speed ?? 320;

let player, zappers, coins, spawn, dist, score, thrusting, over;

function reset() {
  player = { x: WIDTH * 0.25, y: HEIGHT / 2, vy: 0, r: 18 };
  zappers = [];
  coins = [];
  spawn = 0;
  dist = 0;
  score = 0;
  thrusting = false;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  player.vy += (thrusting ? THRUST : 0) * dt + GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.y < player.r) { player.y = player.r; player.vy = 0; }
  if (player.y > HEIGHT - 60 - player.r) { player.y = HEIGHT - 60 - player.r; player.vy = 0; }
  dist += SPEED * dt;
  spawn -= dt;
  if (spawn <= 0) {
    spawn = 0.9;
    const h = 120 + Math.random() * 160;
    const y = 40 + Math.random() * (HEIGHT - 160 - h);
    zappers.push({ x: WIDTH + 40, y, h });
    for (let i = 0; i < 4; i++) coins.push({ x: WIDTH + 120 + i * 34, y: 80 + Math.random() * (HEIGHT - 220), got: false });
  }
  for (const z of zappers) {
    z.x -= SPEED * dt;
    if (player.x + player.r > z.x && player.x - player.r < z.x + 18 &&
        player.y + player.r > z.y && player.y - player.r < z.y + z.h) over = true;
  }
  for (const c of coins) {
    c.x -= SPEED * dt;
    if (!c.got && Math.hypot(c.x - player.x, c.y - player.y) < player.r + 10) { c.got = true; score += 1; }
  }
  zappers = zappers.filter((z) => z.x > -40);
  coins = coins.filter((c) => c.x > -20 && !c.got);
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#161d2e";
  ctx.fillRect(0, HEIGHT - 60, WIDTH, 60);
  ctx.fillStyle = colors[1];
  for (const z of zappers) ctx.fillRect(z.x, z.y, 18, z.h);
  ctx.fillStyle = colors[2];
  for (const c of coins) { ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = thrusting ? colors[2] : "#eef6ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Coins " + score + "   " + Math.floor(dist) + "m", 24, 36);
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

function press() {
  if (over) { reset(); return; }
  thrusting = true;
}
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
window.addEventListener("pointerup", () => (thrusting = false));
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); press(); }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") thrusting = false;
});

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: vertical infinite jumper (Doodle Jump style).
// Auto-bounce off platforms. Move with Left/Right or A/D or tilt-tap. R restarts.

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
const GRAVITY = tuning.gravity ?? 1500;
const BOUNCE = tuning.jump ?? -720;
const MOVE = tuning.speed ?? 360;

const keys = {};
let player, platforms, score, best = 0, over;

function makePlatform(y) {
  return { x: 40 + Math.random() * (WIDTH - 120), y, w: 80 };
}
function reset() {
  player = { x: WIDTH / 2, y: HEIGHT - 120, vy: 0, w: 28 };
  platforms = [{ x: WIDTH / 2 - 40, y: HEIGHT - 60, w: 80 }];
  for (let i = 1; i < 12; i++) platforms.push(makePlatform(HEIGHT - 60 - i * 80));
  score = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  const dir = (keys["right"] ? 1 : 0) - (keys["left"] ? 1 : 0);
  player.x += dir * MOVE * dt;
  if (player.x < 0) player.x = WIDTH;
  if (player.x > WIDTH) player.x = 0;
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.vy > 0) {
    for (const p of platforms) {
      if (
        player.x + player.w / 2 > p.x &&
        player.x - player.w / 2 < p.x + p.w &&
        player.y + 14 > p.y &&
        player.y + 14 < p.y + 22
      ) {
        player.vy = BOUNCE;
      }
    }
  }
  if (player.y < HEIGHT * 0.4) {
    const shift = HEIGHT * 0.4 - player.y;
    player.y = HEIGHT * 0.4;
    score += Math.floor(shift);
    for (const p of platforms) p.y += shift;
  }
  platforms = platforms.filter((p) => p.y < HEIGHT + 20);
  while (platforms.length < 12) {
    const top = Math.min(...platforms.map((p) => p.y));
    platforms.push(makePlatform(top - 70 - Math.random() * 40));
  }
  if (player.y > HEIGHT + 40) {
    over = true;
    best = Math.max(best, score);
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = colors[0];
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.w, 14);
  }
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Height " + score, 24, 38);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 16);
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.fillText("Best " + best, WIDTH / 2, HEIGHT / 2 + 18);
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 52);
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

function setKey(code, on) {
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  keys[e.clientX < WIDTH / 2 ? "left" : "right"] = true;
});
canvas.addEventListener("pointerup", () => {
  keys["left"] = keys["right"] = false;
});

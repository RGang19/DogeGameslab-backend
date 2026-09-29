import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: tower stacking (Stack / Tower Bloxx style).
// A block slides side to side. Tap / click / Space to drop it. Overhang gets sliced.
// R restarts.

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
const BH = 36;
let stack, current, dir, speed, score, camY, over;

function reset() {
  const w = Math.min(220, WIDTH * 0.4);
  stack = [{ x: WIDTH / 2 - w / 2, w }];
  speed = tuning.speed ?? 260;
  spawn();
  score = 0;
  camY = 0;
  over = false;
}
function spawn() {
  const prev = stack[stack.length - 1];
  current = { x: 0, w: prev.w };
  dir = 1;
}
reset();

function update(dt) {
  if (over || !current) return;
  current.x += dir * speed * dt;
  if (current.x <= 0) { current.x = 0; dir = 1; }
  if (current.x + current.w >= WIDTH) { current.x = WIDTH - current.w; dir = -1; }
}

function drop() {
  if (over) { reset(); return; }
  const prev = stack[stack.length - 1];
  const left = Math.max(current.x, prev.x);
  const right = Math.min(current.x + current.w, prev.x + prev.w);
  const overlap = right - left;
  if (overlap <= 0) { over = true; return; }
  stack.push({ x: left, w: overlap });
  score += 1;
  speed += 8;
  camY += BH;
  spawn();
  current.w = overlap;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(0, camY);
  for (let i = 0; i < stack.length; i++) {
    const b = stack[i];
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(b.x, HEIGHT - 80 - i * BH, b.w, BH - 4);
  }
  if (!over && current) {
    ctx.fillStyle = colors[stack.length % colors.length];
    ctx.fillRect(current.x, HEIGHT - 80 - stack.length * BH, current.w, BH - 4);
  }
  ctx.restore();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(score), WIDTH / 2, 56);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Height " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); drop(); });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); drop(); }
  if (e.code === "KeyR") reset();
});

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: helicopter cave flyer.
// Hold tap / Space to rise, release to sink. Stay between the cave walls. R restarts.

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
const LIFT = tuning.jump ?? -900;
const GRAVITY = tuning.gravity ?? 900;
const SPEED = tuning.speed ?? 240;

let player, segments, gapY, gap, score, rising, over;

function reset() {
  player = { x: WIDTH * 0.3, y: HEIGHT / 2, vy: 0, r: 14 };
  segments = [];
  gapY = HEIGHT / 2;
  gap = 240;
  score = 0;
  rising = false;
  over = false;
  for (let x = 0; x < WIDTH + 40; x += 20) addSegment(x);
}
function addSegment(x) {
  gapY += (Math.random() - 0.5) * 60;
  gapY = Math.max(gap / 2 + 20, Math.min(HEIGHT - gap / 2 - 20, gapY));
  segments.push({ x, top: gapY - gap / 2, bot: gapY + gap / 2 });
}
reset();

function update(dt) {
  if (over) return;
  player.vy += (rising ? LIFT : GRAVITY) * dt;
  player.y += player.vy * dt;
  for (const s of segments) s.x -= SPEED * dt;
  if (segments[segments.length - 1].x < WIDTH + 20) {
    addSegment(segments[segments.length - 1].x + 20);
    score += 1;
    gap = Math.max(150, gap - 0.6);
  }
  segments = segments.filter((s) => s.x > -20);
  for (const s of segments) {
    if (Math.abs(s.x - player.x) < 12) {
      if (player.y - player.r < s.top || player.y + player.r > s.bot) over = true;
    }
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = colors[0];
  for (const s of segments) {
    ctx.fillRect(s.x, 0, 22, s.top);
    ctx.fillRect(s.x, s.bot, 22, HEIGHT - s.bot);
  }
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score " + score, 24, 38);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Crashed", WIDTH / 2, HEIGHT / 2 - 10);
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
  rising = true;
}
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
window.addEventListener("pointerup", () => (rising = false));
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); press(); }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") rising = false;
});

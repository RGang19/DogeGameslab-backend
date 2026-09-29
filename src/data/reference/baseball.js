import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: timing-swing baseball / home-run derby.
// A pitch flies in — tap / Space at the right moment to swing. Good timing sends
// it deep for a homer. Three strikes ends the round. R restarts.

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
const GRAVITY = tuning.gravity ?? 500;
const PLATE_Y = () => HEIGHT - 120;
let ball, state, score, hits, strikes, hitBalls, msg, msgT, over;

function pitch() {
  ball = { x: WIDTH / 2 + (Math.random() - 0.5) * 40, y: HEIGHT * 0.18, vy: 240 + Math.random() * 120, swung: false };
  state = "pitch";
}
function reset() {
  hitBalls = [];
  score = 0; hits = 0; strikes = 0; over = false; msg = ""; msgT = 0;
  pitch();
}
reset();

function swing() {
  if (over) { reset(); return; }
  if (state !== "pitch" || ball.swung) return;
  ball.swung = true;
  const dy = Math.abs(ball.y - PLATE_Y());
  if (dy < 70) {
    const quality = 1 - dy / 70;
    const angle = -Math.PI / 3 - quality * 0.3 + (Math.random() - 0.5) * 0.2;
    const power = 520 + quality * 520;
    hitBalls.push({ x: ball.x, y: ball.y, vx: Math.cos(angle) * power * 0.6 + 260, vy: Math.sin(angle) * power });
    hits += 1;
    const homer = quality > 0.6;
    score += homer ? 4 : 1;
    msg = homer ? "HOME RUN!" : "Hit!"; msgT = 1.2;
    setTimeout(() => { if (!over) pitch(); }, 600);
    state = "hit";
  } else {
    strikes += 1; msg = "Strike " + strikes; msgT = 1;
    if (strikes >= 3) over = true; else setTimeout(() => pitch(), 500);
    state = "wait";
  }
}

function update(dt) {
  if (state === "pitch" && !over) {
    ball.y += ball.vy * dt;
    if (ball.y > PLATE_Y() + 80) {
      if (!ball.swung) { strikes += 1; msg = "Strike " + strikes; msgT = 1; if (strikes >= 3) over = true; else pitch(); }
    }
  }
  for (const h of hitBalls) { h.vy += GRAVITY * dt; h.x += h.vx * dt; h.y += h.vy * dt; }
  hitBalls = hitBalls.filter((h) => h.y < HEIGHT + 40 && h.x < WIDTH + 60);
  if (msgT > 0) msgT -= dt;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#16243f";
  ctx.beginPath(); ctx.moveTo(WIDTH / 2, PLATE_Y() + 30); ctx.lineTo(0, HEIGHT); ctx.lineTo(WIDTH, HEIGHT); ctx.fill();
  // strike window
  ctx.strokeStyle = "#2b3a5c"; ctx.strokeRect(WIDTH / 2 - 50, PLATE_Y() - 70, 100, 140);
  // batter
  ctx.fillStyle = colors[0]; ctx.fillRect(WIDTH / 2 - 70, PLATE_Y() - 30, 16, 70);
  if (state === "pitch" && !over) {
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = colors[2];
  for (const h of hitBalls) { ctx.beginPath(); ctx.arc(h.x, h.y, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Hits " + hits + "   Strikes " + strikes + "/3", 20, 36);
  if (msgT > 0) {
    ctx.textAlign = "center"; ctx.fillStyle = colors[2];
    ctx.font = "800 38px Inter, system-ui, sans-serif";
    ctx.fillText(msg, WIDTH / 2, HEIGHT * 0.4);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Struck out — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); swing(); });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); swing(); }
  if (e.code === "KeyR") reset();
});

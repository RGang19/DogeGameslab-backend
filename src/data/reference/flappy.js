import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Flappy-style tap-to-fly through gates.
// Tap, click, or Space to flap. Press R to restart.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
// Fill the whole game frame (portrait on phones): WIDTH/HEIGHT track the
// live canvas size so the playfield always fills the screen, no letterbox.
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
const GRAVITY = tuning.gravity ?? 600;
const FLAP = tuning.jump ?? -320;
const SPEED = tuning.speed ?? 200;
const GAP = tuning.gap ?? 150;

let bird, pipes, spawn, score, over, started;

function reset() {
  bird = { x: 220, y: HEIGHT / 2, vy: 0, r: 16 };
  pipes = [];
  spawn = 0;
  score = 0;
  over = false;
  started = false;
}
reset();

function flap() {
  if (over) {
    reset();
    return;
  }
  started = true;
  bird.vy = FLAP;
}

function update(dt) {
  if (!started || over) return;
  bird.vy += GRAVITY * dt;
  bird.y += bird.vy * dt;

  spawn -= dt;
  if (spawn <= 0) {
    spawn = 1.5;
    const top = 80 + Math.random() * (HEIGHT - GAP - 200);
    pipes.push({ x: WIDTH + 40, top, scored: false });
  }
  for (const p of pipes) {
    p.x -= SPEED * dt;
    if (!p.scored && p.x + 40 < bird.x) {
      p.scored = true;
      score += 1;
    }
    if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + 60) {
      if (bird.y - bird.r < p.top || bird.y + bird.r > p.top + GAP) over = true;
    }
  }
  pipes = pipes.filter((p) => p.x > -80);
  if (bird.y + bird.r > HEIGHT || bird.y - bird.r < 0) over = true;
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const p of pipes) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(p.x, 0, 60, p.top);
    ctx.fillRect(p.x, p.top + GAP, 60, HEIGHT - p.top - GAP);
  }

  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 40);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("Tap, click, or Space to fly", WIDTH / 2, HEIGHT / 2);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or click to restart", WIDTH / 2, HEIGHT / 2 + 28);
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
  e.preventDefault();
  flap();
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  flap();
}, { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    flap();
  }
  if (e.code === "KeyR") reset();
});

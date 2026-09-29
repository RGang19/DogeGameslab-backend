import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: brick breaker. Move the paddle with the pointer
// or arrows, keep the ball alive, clear all bricks to advance a level.
// 3 lives. R restarts.

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
const BASE_BALL_SPEED = tuning.ballSpeed ? tuning.ballSpeed * 60 : 380;
const PADDLE_SPEED = tuning.paddleSpeed ? tuning.paddleSpeed * 60 : 540;

const PADDLE_W = 120;
const PADDLE_H = 14;
const BRICK_ROWS = 5;
const BRICK_COLS = 12;
const BRICK_W = Math.floor((WIDTH - 80) / BRICK_COLS);
const BRICK_H = 26;

let paddle, ball, bricks, lives, score, level, started, over, keys;

function buildBricks() {
  bricks = [];
  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      bricks.push({
        x: 40 + col * BRICK_W,
        y: 60 + row * (BRICK_H + 6),
        w: BRICK_W - 6,
        h: BRICK_H,
        color: colors[row % colors.length],
        points: (BRICK_ROWS - row) * 10
      });
    }
  }
}

function serveBall() {
  const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
  const speed = BASE_BALL_SPEED + (level - 1) * 40;
  ball = {
    x: paddle.x,
    y: HEIGHT - 80,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 8
  };
}

function reset() {
  paddle = { x: WIDTH / 2 };
  lives = 3;
  score = 0;
  level = 1;
  started = false;
  over = false;
  keys = {};
  buildBricks();
  serveBall();
}
reset();

function update(dt) {
  if (!started || over) return;

  if (keys.left) paddle.x -= PADDLE_SPEED * dt;
  if (keys.right) paddle.x += PADDLE_SPEED * dt;
  paddle.x = Math.max(PADDLE_W / 2, Math.min(WIDTH - PADDLE_W / 2, paddle.x));

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.r || ball.x > WIDTH - ball.r) {
    ball.vx *= -1;
    ball.x = Math.max(ball.r, Math.min(WIDTH - ball.r, ball.x));
  }
  if (ball.y < ball.r) {
    ball.vy *= -1;
    ball.y = ball.r;
  }

  // paddle bounce — hit position controls the angle
  const paddleTop = HEIGHT - 40 - PADDLE_H / 2;
  if (
    ball.vy > 0 &&
    ball.y + ball.r >= paddleTop &&
    ball.y + ball.r <= paddleTop + PADDLE_H + 14 &&
    Math.abs(ball.x - paddle.x) <= PADDLE_W / 2 + ball.r
  ) {
    const offset = (ball.x - paddle.x) / (PADDLE_W / 2);
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = -Math.PI / 2 + offset * 1.05;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.y = paddleTop - ball.r;
  }

  for (const brick of bricks) {
    if (brick.dead) continue;
    if (
      ball.x + ball.r > brick.x &&
      ball.x - ball.r < brick.x + brick.w &&
      ball.y + ball.r > brick.y &&
      ball.y - ball.r < brick.y + brick.h
    ) {
      brick.dead = true;
      score += brick.points;
      const fromSide =
        Math.min(Math.abs(ball.x - brick.x), Math.abs(ball.x - brick.x - brick.w)) <
        Math.min(Math.abs(ball.y - brick.y), Math.abs(ball.y - brick.y - brick.h));
      if (fromSide) ball.vx *= -1;
      else ball.vy *= -1;
      break;
    }
  }
  bricks = bricks.filter((b) => !b.dead);

  if (bricks.length === 0) {
    level += 1;
    buildBricks();
    started = false;
    serveBall();
  }

  if (ball.y > HEIGHT + 30) {
    lives -= 1;
    if (lives <= 0) {
      over = true;
    } else {
      started = false;
      serveBall();
    }
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const brick of bricks) {
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  }

  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(paddle.x - PADDLE_W / 2, HEIGHT - 40 - PADDLE_H / 2, PADDLE_W, PADDLE_H);

  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 30);
  ctx.textAlign = "right";
  ctx.fillText("Level " + level + " · Lives " + lives, WIDTH - 28, 30);

  if (!started && !over) {
    ctx.textAlign = "center";
    ctx.fillText("Move with pointer or arrows · tap/Space to launch", WIDTH / 2, HEIGHT / 2 + 60);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
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

function pointerX(e) {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * WIDTH;
}

canvas.addEventListener("pointermove", (e) => {
  if (!over) paddle.x = Math.max(PADDLE_W / 2, Math.min(WIDTH - PADDLE_W / 2, pointerX(e)));
});
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  started = true;
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (over) reset();
    else started = true;
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: pong vs AI. Move with W/S, arrows, or drag.
// First to 7 wins. R restarts.

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
const BALL_SPEED = tuning.ballSpeed ? tuning.ballSpeed * 60 : 360;
const PADDLE_SPEED = tuning.paddleSpeed ? tuning.paddleSpeed * 60 : 420;
const AI_SPEED = tuning.aiSpeed ? tuning.aiSpeed * 60 : 300;
const WIN_SCORE = tuning.winScore ?? 7;

const PADDLE_W = 14;
const PADDLE_H = 96;

let player, ai, ball, playerScore, aiScore, over, started, keys;

function serveBall(toLeft) {
  const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
  const dirX = toLeft ? -1 : 1;
  ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: Math.cos(angle) * BALL_SPEED * dirX,
    vy: Math.sin(angle) * BALL_SPEED,
    r: 9,
    speed: BALL_SPEED
  };
}

function reset() {
  player = { x: 40, y: HEIGHT / 2 };
  ai = { x: WIDTH - 40, y: HEIGHT / 2 };
  playerScore = 0;
  aiScore = 0;
  over = false;
  started = false;
  keys = {};
  serveBall(Math.random() < 0.5);
}
reset();

function paddleHit(paddle) {
  return (
    Math.abs(ball.x - paddle.x) < PADDLE_W / 2 + ball.r &&
    Math.abs(ball.y - paddle.y) < PADDLE_H / 2 + ball.r
  );
}

function bounceOff(paddle, dirX) {
  const offset = (ball.y - paddle.y) / (PADDLE_H / 2);
  ball.speed = Math.min(ball.speed * 1.04, 780);
  ball.vx = dirX * Math.abs(ball.speed * Math.cos(offset * 0.9));
  ball.vy = ball.speed * Math.sin(offset * 0.9);
  ball.x = paddle.x + dirX * (PADDLE_W / 2 + ball.r + 1);
}

function update(dt) {
  if (!started || over) return;

  if (keys.up) player.y -= PADDLE_SPEED * dt;
  if (keys.down) player.y += PADDLE_SPEED * dt;
  player.y = Math.max(PADDLE_H / 2, Math.min(HEIGHT - PADDLE_H / 2, player.y));

  const chase = ball.y - ai.y;
  ai.y += Math.max(-AI_SPEED * dt, Math.min(AI_SPEED * dt, chase * 0.12));
  ai.y = Math.max(PADDLE_H / 2, Math.min(HEIGHT - PADDLE_H / 2, ai.y));

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - ball.r < 0 || ball.y + ball.r > HEIGHT) {
    ball.vy *= -1;
    ball.y = Math.max(ball.r, Math.min(HEIGHT - ball.r, ball.y));
  }
  if (ball.vx < 0 && paddleHit(player)) bounceOff(player, 1);
  if (ball.vx > 0 && paddleHit(ai)) bounceOff(ai, -1);

  if (ball.x < -30) {
    aiScore += 1;
    if (aiScore >= WIN_SCORE) over = true;
    else serveBall(false);
  }
  if (ball.x > WIDTH + 30) {
    playerScore += 1;
    if (playerScore >= WIN_SCORE) over = true;
    else serveBall(true);
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "#1c2742";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(player.x - PADDLE_W / 2, player.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
  ctx.fillStyle = colors[1];
  ctx.fillRect(ai.x - PADDLE_W / 2, ai.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);

  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 44px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(playerScore), WIDTH / 2 - 80, 50);
  ctx.fillText(String(aiScore), WIDTH / 2 + 80, 50);

  if (!started) {
    ctx.font = "800 26px Inter, system-ui, sans-serif";
    ctx.fillText("W/S, arrows, or drag · tap to start", WIDTH / 2, HEIGHT / 2 + 70);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText(playerScore > aiScore ? "You Win!" : "AI Wins", WIDTH / 2, HEIGHT / 2 - 20);
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

function pointerY(e) {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientY - rect.top) / rect.height) * HEIGHT;
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  started = true;
  player.y = Math.max(PADDLE_H / 2, Math.min(HEIGHT - PADDLE_H / 2, pointerY(e)));
});
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons > 0 && started && !over) {
    player.y = Math.max(PADDLE_H / 2, Math.min(HEIGHT - PADDLE_H / 2, pointerY(e)));
  }
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;
  if (e.code === "Space") {
    e.preventDefault();
    started = true;
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
});

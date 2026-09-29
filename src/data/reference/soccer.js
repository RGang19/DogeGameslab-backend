import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: head soccer vs AI. Arrows/A-D move, Up/W/Space
// jumps, hit the ball with your head to knock it into the right goal.
// First to 5 wins. Tap left/right half to move, tap upper half to jump.
// R restarts.

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
const MOVE_SPEED = tuning.speed ? tuning.speed * 60 : 320;
const JUMP = tuning.jump ? -tuning.jump * 60 : -560;
const GRAVITY = tuning.gravity ? tuning.gravity * 60 : 1400;
const WIN_SCORE = tuning.winScore ?? 5;

const GROUND = HEIGHT - 60;
const GOAL_W = 70;
const GOAL_H = 150;

let player, ai, ball, playerScore, aiScore, over, started, keys, kickFlash;

function resetPositions(serveLeft) {
  player = { x: 240, y: GROUND, vy: 0, r: 30 };
  ai = { x: WIDTH - 240, y: GROUND, vy: 0, r: 30 };
  ball = {
    x: WIDTH / 2,
    y: GROUND - 220,
    vx: serveLeft ? -90 : 90,
    vy: 0,
    r: 16
  };
}

function reset() {
  playerScore = 0;
  aiScore = 0;
  over = false;
  started = false;
  keys = {};
  kickFlash = 0;
  resetPositions(Math.random() < 0.5);
}
reset();

function headBounce(head) {
  const dx = ball.x - head.x;
  const dy = ball.y - (head.y - head.r);
  const dist = Math.hypot(dx, dy);
  if (dist > head.r + ball.r) return;
  const nx = dx / (dist || 1);
  const ny = dy / (dist || 1);
  const power = 480;
  ball.vx = nx * power + (head.vx ?? 0) * 0.4;
  ball.vy = ny * power - 220;
  ball.x = head.x + nx * (head.r + ball.r + 1);
  ball.y = head.y - head.r + ny * (head.r + ball.r + 1);
  kickFlash = 0.12;
}

function updateBody(body, dt) {
  body.vy += GRAVITY * dt;
  body.y += body.vy * dt;
  if (body.y > GROUND) {
    body.y = GROUND;
    body.vy = 0;
  }
}

function update(dt) {
  if (!started || over) return;

  // player movement
  let vx = 0;
  if (keys.left) vx -= MOVE_SPEED;
  if (keys.right) vx += MOVE_SPEED;
  player.x = Math.max(40, Math.min(WIDTH / 2 - 20, player.x + vx * dt));
  player.vx = vx;
  updateBody(player, dt);

  // simple AI: chase the ball, jump when it is overhead and close
  const chase = ball.x - ai.x;
  ai.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, chase * 3));
  ai.x = Math.max(WIDTH / 2 + 20, Math.min(WIDTH - 40, ai.x + ai.vx * dt));
  if (ai.y >= GROUND - 1 && Math.abs(chase) < 90 && ball.y < ai.y - 60) ai.vy = JUMP;
  updateBody(ai, dt);

  // ball physics
  ball.vy += GRAVITY * 0.82 * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.vx *= 1 - 0.12 * dt;

  if (ball.y > GROUND + 24) {
    ball.y = GROUND + 24;
    ball.vy = -Math.abs(ball.vy) * 0.74;
    if (Math.abs(ball.vy) < 40) ball.vy = 0;
  }
  if (ball.y < ball.r) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy) * 0.74;
  }

  // goal mouths are open; other walls bounce
  const inLeftGoalMouth = ball.y > GROUND - GOAL_H + 24;
  if (ball.x < ball.r + 8 && !inLeftGoalMouth) {
    ball.x = ball.r + 8;
    ball.vx = Math.abs(ball.vx) * 0.8;
  }
  if (ball.x > WIDTH - ball.r - 8 && !inLeftGoalMouth) {
    ball.x = WIDTH - ball.r - 8;
    ball.vx = -Math.abs(ball.vx) * 0.8;
  }

  headBounce(player);
  headBounce(ai);
  if (kickFlash > 0) kickFlash -= dt;

  // goals
  if (ball.x < -ball.r) {
    aiScore += 1;
    if (aiScore >= WIN_SCORE) over = true;
    else resetPositions(false);
  }
  if (ball.x > WIDTH + ball.r) {
    playerScore += 1;
    if (playerScore >= WIN_SCORE) over = true;
    else resetPositions(true);
  }
}

function drawGoal(x, mirrored) {
  ctx.strokeStyle = "#eef6ff";
  ctx.lineWidth = 4;
  ctx.strokeRect(mirrored ? x - GOAL_W : x, GROUND - GOAL_H + 24, GOAL_W, GOAL_H);
}

function drawHead(head, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(head.x, head.y - head.r, head.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#070a12";
  ctx.beginPath();
  ctx.arc(head.x + (color === colors[1] ? -8 : 8), head.y - head.r - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#11251b";
  ctx.fillRect(0, GROUND + 24, WIDTH, HEIGHT - GROUND);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, GROUND + 24, WIDTH, 4);

  drawGoal(8, false);
  drawGoal(WIDTH - 8, true);

  drawHead(player, "#eef6ff");
  drawHead(ai, colors[1]);

  ctx.fillStyle = kickFlash > 0 ? "#fff" : colors[2];
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 44px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(playerScore + " - " + aiScore, WIDTH / 2, 50);

  if (!started) {
    ctx.font = "800 24px Inter, system-ui, sans-serif";
    ctx.fillText("Arrows move · Up/Space jumps · tap to start", WIDTH / 2, HEIGHT / 2 - 60);
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

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  started = true;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  if (y < HEIGHT * 0.4 && player.y >= GROUND - 1) player.vy = JUMP;
  keys.left = x < WIDTH / 3;
  keys.right = x > WIDTH / 3 && x < WIDTH * 0.6;
});
window.addEventListener("pointerup", () => {
  keys.left = false;
  keys.right = false;
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
    e.preventDefault();
    started = true;
    if (player.y >= GROUND - 1) player.vy = JUMP;
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});
